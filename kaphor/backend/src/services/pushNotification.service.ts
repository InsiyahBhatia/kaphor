import axios from 'axios';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import admin from '../lib/firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessagePayload {
  to?: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  badge?: number;
}

/**
 * Converts arbitrary payload data to string-only key-value pairs required by FCM.
 */
function serializeFcmData(data: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  return result;
}

/**
 * Dispatch directly via Firebase Cloud Messaging (FCM v1) for native Android/iOS tokens.
 * Works natively when phone is locked or app is killed.
 */
async function sendViaFirebaseAdmin(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, any>,
  channelId: string
): Promise<EngineResult> {
  try {
    if (!admin.apps.length) {
      logger.warn('Firebase Admin is not initialized; cannot dispatch FCM push');
      return { success: false, reason: 'Firebase Admin is not initialized on the server' };
    }

    const stringData = serializeFcmData(data);

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          channelId: channelId || 'default',
          sound: 'default',
          priority: 'high',
          visibility: 'public',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    logger.info('Native FCM push dispatched successfully via Firebase Admin', {
      tokenSnippet: fcmToken.slice(0, 16) + '...',
      title,
      messageId: response,
    });
    return { success: true };
  } catch (error: any) {
    const errorCode = error?.code || error?.errorInfo?.code;
    logger.error('Firebase Admin FCM dispatch failed', {
      errorCode,
      error: error?.message,
    });

    // If token is invalid or device unregistered, return false so caller can handle cleanup
    if (
      errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token'
    ) {
      return { success: false, reason: 'The device token is no longer registered on this phone' };
    }
    return { success: false, reason: error?.message || 'Firebase Admin FCM dispatch failed' };
  }
}

interface EngineResult {
  success: boolean;
  reason?: string;
}

/**
 * Dispatch via Expo's push notification service for Expo Push tokens.
 */
async function sendViaExpoPush(
  expoToken: string,
  title: string,
  body: string,
  data: Record<string, any>,
  channelId: string
): Promise<EngineResult> {
  try {
    const payload: PushMessagePayload = {
      to: expoToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: channelId || 'default',
    };

    const response = await axios.post(EXPO_PUSH_URL, payload, {
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    });

    // Expo may return a single ticket object or an array of tickets.
    const dataField = response.data?.data;
    const tickets = Array.isArray(dataField) ? dataField : dataField ? [dataField] : [];
    const ticket = tickets[0];

    if (ticket && ticket.status === 'error') {
      logger.warn('Expo Push Ticket error returned', {
        expoToken: expoToken.slice(0, 20) + '...',
        message: ticket.message,
        details: ticket.details,
      });

      const reason =
        typeof ticket.message === 'string'
          ? ticket.message
          : 'Expo push service returned an error ticket';
      return { success: false, reason };
    }

    if (!ticket) {
      logger.warn('Expo Push returned an unexpected response', {
        expoToken: expoToken.slice(0, 20) + '...',
        body: JSON.stringify(response.data).slice(0, 500),
      });
      return { success: false, reason: 'Expo push service returned an unexpected response' };
    }

    logger.info('Expo push notification dispatched successfully', {
      expoToken: expoToken.slice(0, 20) + '...',
      title,
      ticketId: ticket?.id,
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to send push notification via Expo Push API', {
      expoToken: expoToken.slice(0, 20) + '...',
      error: error.response?.data || error.message,
    });
    return { success: false, reason: error.response?.data?.message || error.message || 'Expo Push API request failed' };
  }
}

export interface PushDispatchResult extends EngineResult {
  tokenKind: 'expo-go' | 'expo' | 'native' | 'none';
  engine: 'expo' | 'fcm' | 'none';
  firebaseReady: boolean;
  userHasToken: boolean;
}

/**
 * Sends a native phone push notification to a specific user.
 * Automatically chooses the optimal engine (Direct Firebase Admin FCM or Expo Push API)
 * based on token format.
 * Guarantees out-of-app delivery to Android lock screen and system notification drawer.
 */
export async function sendPushNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any> = {},
  channelId: string = 'default'
): Promise<boolean> {
  const outcome = await sendPushWithDiagnostics(userId, title, body, data, channelId);
  return outcome.success;
}

export async function sendPushWithDiagnostics(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any> = {},
  channelId: string = 'default'
): Promise<PushDispatchResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, displayName: true },
    });

    if (!user || !user.pushToken) {
      return {
        success: false,
        reason: 'No push token registered for this account',
        tokenKind: 'none',
        engine: 'none',
        firebaseReady: admin.apps.length > 0,
        userHasToken: false,
      };
    }

    const pushToken = user.pushToken.trim();
    if (!pushToken) {
      return {
        success: false,
        reason: 'Push token is empty',
        tokenKind: 'none',
        engine: 'none',
        firebaseReady: admin.apps.length > 0,
        userHasToken: true,
      };
    }

    // Determine token type and dispatch via appropriate engine
    const isExpoGoToken = pushToken.startsWith('ExponentPushToken[');
    const isExpoToken = isExpoGoToken || pushToken.startsWith('ExpoPushToken[');

    const firebaseReady = admin.apps.length > 0;

    if (isExpoToken) {
      const engineResult = await sendViaExpoPush(pushToken, title, body, data, channelId);
      return {
        ...engineResult,
        tokenKind: isExpoGoToken ? 'expo-go' : 'expo',
        engine: 'expo',
        firebaseReady,
        userHasToken: true,
      };
    }

    // Native FCM token (Android standalone APK / iOS APNs device token)
    const engineResult = await sendViaFirebaseAdmin(pushToken, title, body, data, channelId);
    return {
      ...engineResult,
      tokenKind: 'native',
      engine: 'fcm',
      firebaseReady,
      userHasToken: true,
    };
  } catch (error: any) {
    logger.error('sendPushNotificationToUser failed', {
      userId,
      error: error?.message,
    });
    return {
      success: false,
      reason: error?.message || 'Push dispatch failed',
      tokenKind: 'none',
      engine: 'none',
      firebaseReady: admin.apps.length > 0,
      userHasToken: false,
    };
  }
}

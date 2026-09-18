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
): Promise<boolean> {
  try {
    if (!admin.apps.length) {
      logger.warn('Firebase Admin is not initialized; cannot dispatch FCM push');
      return false;
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
    return true;
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
      return false;
    }
    return false;
  }
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
): Promise<boolean> {
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

    const ticket = response.data?.data?.[0];
    if (ticket && ticket.status === 'error') {
      logger.warn('Expo Push Ticket error returned', {
        expoToken: expoToken.slice(0, 20) + '...',
        message: ticket.message,
        details: ticket.details,
      });

      if (ticket.details?.error === 'DeviceNotRegistered') {
        return false;
      }
      return false;
    }

    logger.info('Expo push notification dispatched successfully', {
      expoToken: expoToken.slice(0, 20) + '...',
      title,
      ticketId: ticket?.id,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send push notification via Expo Push API', {
      expoToken: expoToken.slice(0, 20) + '...',
      error: error.response?.data || error.message,
    });
    return false;
  }
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
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, displayName: true },
    });

    if (!user || !user.pushToken) {
      return false;
    }

    const pushToken = user.pushToken.trim();
    if (!pushToken) {
      return false;
    }

    // Determine token type and dispatch via appropriate engine
    const isExpoToken =
      pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken[');

    let success = false;
    if (isExpoToken) {
      success = await sendViaExpoPush(pushToken, title, body, data, channelId);
    } else {
      // Native FCM token (Android standalone APK / iOS APNs device token)
      success = await sendViaFirebaseAdmin(pushToken, title, body, data, channelId);
    }

    return success;
  } catch (error: any) {
    logger.error('sendPushNotificationToUser failed', {
      userId,
      error: error?.message,
    });
    return false;
  }
}

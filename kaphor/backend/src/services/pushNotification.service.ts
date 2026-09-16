import axios from 'axios';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

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
 * Sends a native phone push notification to a specific user via Expo's push service.
 * Supports background / lockscreen banners even when the app is completely closed.
 */
export async function sendPushNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, displayName: true },
    });

    if (!user || !user.pushToken) {
      // User has not registered a push token or notifications disabled
      return false;
    }

    const pushToken = user.pushToken.trim();
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      logger.warn('Invalid Expo push token format for user', { userId, pushToken });
      return false;
    }

    const payload: PushMessagePayload = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    };

    const response = await axios.post(EXPO_PUSH_URL, payload, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    });

    logger.info('Expo push notification dispatched successfully', {
      userId,
      title,
      status: response.status,
      data: response.data,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send push notification via Expo', {
      userId,
      error: error.response?.data || error.message,
    });
    return false;
  }
}

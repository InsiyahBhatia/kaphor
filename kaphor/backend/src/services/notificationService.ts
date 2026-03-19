import db from '../lib/prisma';
import { emitToUser } from '../lib/socket';
import { logger } from '../lib/logger';
import axios from 'axios';

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  data?: any;
}

/**
 * Sends a notification to a specific user.
 * 1. Persists to the database.
 * 2. Emits a real-time event via Socket.IO.
 * 3. (Optional) Sends a push notification via Expo.
 */
export async function sendNotification(userId: string, payload: NotificationPayload): Promise<void> {
  try {
    // 1. Create in DB
    const notification = await db.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      },
    });

    // 2. Emit Socket.IO event
    // We emit the new notification object so the frontend can append it
    await emitToUser(userId, 'notification:new', notification);

    // 3. Optional: Expo Push Notification
    // We would fetch the user's push token from the DB first.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true } // In a real app, select pushToken
    });

    // Stub for Expo Push Notification
    // if (user?.pushToken) {
    //   await sendPushNotification(user.pushToken, payload.title, payload.body, payload.data);
    // }

    logger.info('Notification sent', { userId, type: payload.type });
  } catch (error) {
    logger.error('Failed to send notification', { userId, error });
  }
}

async function sendPushNotification(expoPushToken: string, title: string, body: string, data?: any) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data || {},
  };

  try {
    await axios.post('https://exp.host/--/api/v2/push/send', message, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Expo push notification failed', { error });
  }
}

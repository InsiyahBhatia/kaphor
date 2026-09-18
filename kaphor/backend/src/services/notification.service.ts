import db from '../lib/prisma';
import { emitToUser } from '../lib/socket';
import { logger } from '../lib/logger';
import { sendPushNotificationToUser } from './pushNotification.service';

export type NotificationType =
  | 'ORDER_PAID' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED'
  | 'ORDER_REQUESTED' | 'ORDER_APPROVED' | 'ORDER_DECLINED'
  | 'NEW_MESSAGE' | 'DIRECT_MESSAGE' | 'PEER_REVIEW'
  | 'SWAP_REQUEST' | 'SWAP_ACCEPTED' | 'SWAP_REJECTED' | 'SWAP_COMPLETED'
  | 'SWAP_SHIPPED' | 'SWAP_RECEIVED' | 'SWAP_DISPUTED' | 'SWAP_CANCELLED'
  | 'RENTAL_RESERVED' | 'RENTAL_ACTIVE' | 'RENTAL_RETURNED' | 'RENTAL_OVERDUE'
  | 'CIRCULAR_COMPLETED'
  | 'ADMIN_BESPOKE_REQUEST';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
}

/**
 * Creates a notification in the DB and attempts to emit it via Socket.io.
 * Also dispatches a background push notification to the user's mobile device.
 */
export async function createNotification(payload: NotificationPayload) {
  try {
    const notification = await db.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        isRead: false,
      },
    });

    // Emit live to the user if they are online
    await emitToUser(payload.userId, 'new_notification', notification);

    // Push notification to user's phone (works when app is in background / closed)
    sendPushNotificationToUser(
      payload.userId,
      payload.title,
      payload.body,
      {
        notificationId: notification.id,
        type: payload.type,
        ...payload.data,
      }
    ).catch(err => {
      logger.warn('Background push notification error', { error: err });
    });

    logger.info('Notification created and emitted', {
      userId: payload.userId,
      type: payload.type,
      id: notification.id,
    });

    return notification;
  } catch (error) {
    logger.error('Failed to create notification', {
      error: error instanceof Error ? error.message : String(error),
      userId: payload.userId,
    });
    // We don't throw here to avoid failing the transaction flow, but we log it.
    return null;
  }
}

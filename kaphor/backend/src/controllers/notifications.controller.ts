import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

// ── GET /notifications ───────────────────────────────────────────────────────
export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { limit = 20, cursor } = req.query;
    const skip = cursor ? 1 : 0;
    const cursorObj = cursor ? { id: cursor as string } : undefined;

    const notifications = await db.notification.findMany({
      where: { userId: req.user.id },
      take: Number(limit),
      skip,
      cursor: cursorObj,
      orderBy: { createdAt: 'desc' },
    });

    const nextCursor = notifications.length === Number(limit) 
      ? notifications[notifications.length - 1].id 
      : null;

    res.json({
      data: notifications,
      nextCursor,
    });
  } catch (error) {
    logger.error('getNotifications failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

// ── PATCH /notifications/:id/read ────────────────────────────────────────────
export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const { id } = req.params;

    const updated = await db.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found' });
      return;
    }

    res.json({ message: 'Marked as read' });
  } catch (error) {
    logger.error('markAsRead failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

// ── PATCH /notifications/read-all ───────────────────────────────────────────
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    await db.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'All marked as read' });
  } catch (error) {
    logger.error('markAllAsRead failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

// ── DELETE /notifications/:id ────────────────────────────────────────────────
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    const { id } = req.params;

    await db.notification.deleteMany({
      where: { id, userId: req.user.id },
    });

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    logger.error('deleteNotification failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

// ── DELETE /notifications ─────────────────────────────────────────────────────
export async function clearAllNotifications(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    await db.notification.deleteMany({
      where: { userId: req.user.id },
    });

    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    logger.error('clearAllNotifications failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

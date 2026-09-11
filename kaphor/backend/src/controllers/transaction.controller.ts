import { Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { AuthRequest } from '../middleware/auth';
import { emitToUser } from '../lib/socket';
import { updateImpactOnTransaction } from '../services/impact.service';
import { createNotification } from '../services/notification.service';
import { withPrismaRetry } from '../lib/prisma';

/** Messaging allowed for any active order, including PENDING (pre-payment coordination). */
const MESSAGE_BLOCKED: Set<string> = new Set(['CANCELLED', 'REFUNDED']);

function orderAllowsMessaging(status: string): boolean {
  return !MESSAGE_BLOCKED.has(status);
}

function isParticipant(order: { buyerId: string; sellerId: string }, userId: string): boolean {
  return order.buyerId === userId || order.sellerId === userId;
}

const orderInclude = {
  items: {
    include: {
      garment: { select: { id: true, title: true, brand: true, images: true } },
    },
  },
  buyer: {
    select: { id: true, displayName: true, username: true, avatar: true },
  },
  seller: {
    select: { id: true, displayName: true, username: true, avatar: true },
  },
  peerReview: true,
} as const;

export async function listTransactionOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const uid = req.user.id;
    const orders = await withPrismaRetry(() =>
      db.order.findMany({
        where: {
          OR: [{ buyerId: uid }, { sellerId: uid }],
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          ...orderInclude,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, body: true, createdAt: true, senderId: true },
          },
        },
      })
    );
    res.json({ data: orders });
  } catch (e) {
    logger.error('listTransactionOrders failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load orders' });
  }
}

export async function getOrderDetail(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { orderId } = req.params;
    const order: any = await withPrismaRetry(() =>
      db.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      })
    );

    if (!order || !isParticipant(order, req.user.id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    const orderData: any = { ...order };
    if (orderData.items) {
      const { getDownloadUrl } = await import('../lib/s3');
      orderData.items = await Promise.all(
        orderData.items.map(async (item: any) => {
          if (item.garment && item.garment.images) {
            const resolvedImages = await Promise.all(
              item.garment.images.map((img: string) => getDownloadUrl(img))
            );
            return {
              ...item,
              garment: { ...item.garment, images: resolvedImages },
            };
          }
          return item;
        })
      );
    }

    // Find associated unified conversation
    const firstGarmentId = order.items?.[0]?.garmentId || null;
    const conv = await db.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: order.buyerId, participant2Id: order.sellerId, garmentId: firstGarmentId },
          { participant1Id: order.sellerId, participant2Id: order.buyerId, garmentId: firstGarmentId },
          { participant1Id: order.buyerId, participant2Id: order.sellerId },
          { participant1Id: order.sellerId, participant2Id: order.buyerId },
        ],
      },
      select: { id: true },
    });
    orderData.conversationId = conv?.id || null;

    res.json({ data: orderData });
  } catch (e) {
    logger.error('getOrderDetail failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load order' });
  }
}

export async function markOrderShipped(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { orderId } = req.params;
    const order: any = await withPrismaRetry(() => db.order.findUnique({ where: { id: orderId } }));
    if (!order || order.sellerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only the seller can mark shipped' });
      return;
    }
    if (order.status !== 'CONFIRMED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Order must be paid (confirmed) before shipping' });
      return;
    }
    const updated = await db.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
      include: orderInclude,
    });

    // Notify Buyer
    await createNotification({
      userId: order.buyerId,
      type: 'ORDER_SHIPPED',
      title: '📦 Item Shipped!',
      body: `Your order for "${updated.items[0]?.garment?.title}" has been shipped.`,
      data: { orderId: updated.id }
    });

    res.json({ data: updated });
  } catch (e) {
    logger.error('markOrderShipped failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update order' });
  }
}

export async function markOrderDelivered(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { orderId } = req.params;
    const order: any = await withPrismaRetry(() => db.order.findUnique({ where: { id: orderId } }));
    if (!order || order.buyerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only the buyer can confirm delivery' });
      return;
    }
    if (order.status !== 'SHIPPED' && order.status !== 'CONFIRMED') {
      res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'Order cannot be marked delivered from this status' });
      return;
    }
    const updated = await db.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
      include: orderInclude,
    });

    // Notify Seller
    await createNotification({
      userId: order.sellerId,
      type: 'ORDER_DELIVERED',
      title: '✅ Delivery Confirmed',
      body: `The buyer confirmed receipt of "${updated.items[0]?.garment?.title}".`,
      data: { orderId: updated.id }
    });

    // Dynamic Impact Update
    updateImpactOnTransaction(orderId).catch((err) =>
      logger.error('Background impact update failed', { orderId, error: err.message })
    );

    res.json({ data: updated });
  } catch (e) {
    logger.error('markOrderDelivered failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update order' });
  }
}

export async function getOrderMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { orderId } = req.params;
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || !isParticipant(order, req.user.id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }
    if (!orderAllowsMessaging(order.status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Messaging is closed for this order' });
      return;
    }
    const messages = await withPrismaRetry(() =>
      db.orderMessage.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, displayName: true, avatar: true, username: true } },
        },
      })
    );
    res.json({ data: messages });
  } catch (e) {
    logger.error('getOrderMessages failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load messages' });
  }
}

export async function postOrderMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { orderId } = req.params;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (body.length < 1 || body.length > 4000) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Message must be 1–4000 characters' });
      return;
    }
    const order: any = await withPrismaRetry(() => db.order.findUnique({ where: { id: orderId } }));
    if (!order || !isParticipant(order, req.user.id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }
    if (!orderAllowsMessaging(order.status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Messaging is closed for this order' });
      return;
    }
    const msg = await db.orderMessage.create({
      data: {
        orderId,
        senderId: req.user.id,
        body,
      },
      include: {
        sender: { select: { id: true, displayName: true, avatar: true, username: true } },
      },
    });

    // Notify the other participant in real-time
    const recipientId = order.buyerId === req.user.id ? order.sellerId : order.buyerId;
    emitToUser(recipientId, 'new_message', {
      orderId,
      message: msg,
    }).catch((err) => logger.error('Failed to emit message socket event', { error: err.message }));

    res.status(201).json({ data: msg });
  } catch (e) {
    logger.error('postOrderMessage failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to send message' });
  }
}

export async function postPeerReview(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { orderId } = req.params;
    const rating = Number(req.body?.rating);
    const comment =
      typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : undefined;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Rating must be an integer 1–5' });
      return;
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { peerReview: true },
    });
    if (!order || order.buyerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only the buyer can review the seller' });
      return;
    }
    if (order.status !== 'DELIVERED') {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'You can review the seller after the order is marked delivered',
      });
      return;
    }
    if (order.peerReview) {
      res.status(409).json({ error: 'CONFLICT', message: 'You already reviewed this transaction' });
      return;
    }

    const review = await db.peerReview.create({
      data: {
        orderId,
        reviewerId: req.user.id,
        sellerId: order.sellerId,
        rating,
        comment: comment || null,
      },
    });

    // Notify Seller
    await createNotification({
      userId: order.sellerId,
      type: 'PEER_REVIEW',
      title: '⭐️ New Review!',
      body: `${req.user.displayName} left you a ${rating}-star review for the ${order.items[0]?.garment?.title || 'item'}.`,
      data: { orderId }
    });

    res.status(201).json({ data: review });
  } catch (e) {
    logger.error('postPeerReview failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save review' });
  }
}

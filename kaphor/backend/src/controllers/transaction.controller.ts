import { Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { AuthRequest } from '../middleware/auth';
import { emitToUser } from '../lib/socket';
import { updateImpactOnTransaction } from '../services/impact.service';
import { createNotification } from '../services/notification.service';
import { withPrismaRetry } from '../lib/prisma';
import { transferGarmentsToBuyer } from '../services/garment-claim.service';

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
    const orders: any[] = (await withPrismaRetry(() =>
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
    )) as any[];

    const { getDownloadUrl } = await import('../lib/cloudinary');
    const resolvedOrders = await Promise.all(
      orders.map(async (order: any) => {
        const orderCopy = { ...order };
        if (orderCopy.items) {
          orderCopy.items = await Promise.all(
            orderCopy.items.map(async (item: any) => {
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
        if (orderCopy.buyer?.avatar) {
          orderCopy.buyer.avatar = await getDownloadUrl(orderCopy.buyer.avatar);
        }
        if (orderCopy.seller?.avatar) {
          orderCopy.seller.avatar = await getDownloadUrl(orderCopy.seller.avatar);
        }

        const isBuyer = orderCopy.buyerId === uid;
        orderCopy.userRole = isBuyer ? 'BUYER' : 'SELLER';
        orderCopy.needsShipping = !isBuyer && orderCopy.status === 'CONFIRMED';
        orderCopy.inTransit = orderCopy.status === 'SHIPPED';
        orderCopy.isCompleted = orderCopy.status === 'DELIVERED';

        return orderCopy;
      })
    );

    res.json({ data: resolvedOrders });
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
      const { getDownloadUrl } = await import('../lib/cloudinary');
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

    const isBuyer = orderData.buyerId === req.user.id;
    orderData.userRole = isBuyer ? 'BUYER' : 'SELLER';
    orderData.needsShipping = !isBuyer && orderData.status === 'CONFIRMED';
    orderData.inTransit = orderData.status === 'SHIPPED';
    orderData.isCompleted = orderData.status === 'DELIVERED';

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
    const { trackingNumber, carrier } = req.body as { trackingNumber?: string; carrier?: string };
    const awb = trackingNumber || `KPH-DEL-${Math.floor(100000 + Math.random() * 900000)}`;
    const courierName = carrier || 'Delhivery Express';
    const currentHistory = Array.isArray(order.trackingHistory) ? order.trackingHistory : [];

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
        trackingNumber: awb,
        carrier: courierName,
        trackingHistory: [
          ...currentHistory,
          { status: 'BOOKED', timestamp: new Date().toISOString(), note: `Shipment booked with ${courierName}. AWB: ${awb}` },
          { status: 'PICKED_UP', timestamp: new Date().toISOString(), note: 'Package picked up from seller atelier.' },
          { status: 'IN_TRANSIT', timestamp: new Date().toISOString(), note: 'In transit to buyer destination facility.' },
        ],
      },
      include: orderInclude,
    });

    // Notify Buyer
    await createNotification({
      userId: order.buyerId,
      type: 'ORDER_SHIPPED',
      title: '📦 Order Shipped!',
      body: `Your order for "${updated.items[0]?.garment?.title || 'item'}" has been shipped.`,
      data: { orderId: updated.id, targetRoute: `/(tabs)/shop/orders/${updated.id}` }
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
    const currentHistory = Array.isArray(order.trackingHistory) ? order.trackingHistory : [];
    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        trackingHistory: [
          ...currentHistory,
          { status: 'DELIVERED', timestamp: new Date().toISOString(), note: 'Package delivered to buyer doorstep. 48-hour condition inspection window is now active.' },
        ],
      },
      include: orderInclude,
    });

    // Ownership transfers at delivery: garments become the buyer's property.
    await transferGarmentsToBuyer(orderId, order.buyerId);

    // Notify Seller
    await createNotification({
      userId: order.sellerId,
      type: 'ORDER_DELIVERED',
      title: '✅ Delivery Confirmed',
      body: `The buyer confirmed receipt of "${updated.items[0]?.garment?.title || 'item'}".`,
      data: { orderId: updated.id, targetRoute: `/(tabs)/shop/orders/${updated.id}` }
    });

    // Notify Buyer to leave a review
    await createNotification({
      userId: order.buyerId,
      type: 'PEER_REVIEW',
      title: '⭐ Rate Your Purchase',
      body: `How was your purchase of "${updated.items[0]?.garment?.title || 'item'}"? Leave a review for the seller!`,
      data: { orderId: updated.id, userId: order.sellerId, targetRoute: `/(tabs)/shop/orders/${updated.id}?review=true` }
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
      include: {
        peerReview: true,
        items: {
          include: {
            garment: { select: { title: true } },
          },
        },
      },
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
    const garmentTitle = order.items?.[0]?.garment?.title || 'item';
    await createNotification({
      userId: order.sellerId,
      type: 'PEER_REVIEW',
      title: '⭐️ New Review!',
      body: `${req.user.displayName} left you a ${rating}-star review for the ${garmentTitle}.`,
      data: { orderId }
    });

    res.status(201).json({ data: review });
  } catch (e) {
    logger.error('postPeerReview failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save review' });
  }
}

export async function getOrdersSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const uid = req.user.id;

    const [orders, rentals, swaps] = await Promise.all([
      db.order.findMany({
        where: { OR: [{ buyerId: uid }, { sellerId: uid }] },
        select: { id: true, buyerId: true, sellerId: true, status: true },
      }),
      db.rental.findMany({
        where: {
          OR: [
            { renterId: uid },
            { garment: { sellerId: uid } },
          ],
        },
        select: { id: true, renterId: true, status: true, garment: { select: { sellerId: true } } },
      }),
      db.swap.findMany({
        where: { OR: [{ initiatorId: uid }, { receiverId: uid }] },
        select: { id: true, initiatorId: true, receiverId: true, status: true },
      }),
    ]);

    // Calculate Orders
    let buyingActive = 0;
    let sellingActive = 0;
    let sellingNeedsShip = 0;
    let ordersCompleted = 0;

    for (const o of orders) {
      if (o.buyerId === uid) {
        if (o.status === 'CONFIRMED' || o.status === 'SHIPPED') buyingActive++;
        if (o.status === 'DELIVERED') ordersCompleted++;
      }
      if (o.sellerId === uid) {
        if (o.status === 'CONFIRMED') {
          sellingActive++;
          sellingNeedsShip++;
        } else if (o.status === 'SHIPPED') {
          sellingActive++;
        }
      }
    }

    // Calculate Rentals
    let borrowingActive = 0;
    let lendingActive = 0;
    let rentalsCompleted = 0;

    for (const r of rentals) {
      if (r.renterId === uid) {
        if (r.status === 'RESERVED' || r.status === 'ACTIVE') borrowingActive++;
        if (r.status === 'RETURNED') rentalsCompleted++;
      }
      if (r.garment?.sellerId === uid) {
        if (r.status === 'RESERVED' || r.status === 'ACTIVE') lendingActive++;
      }
    }

    // Calculate Swaps
    let swapsActive = 0;
    let swapsCompleted = 0;

    for (const s of swaps) {
      if (s.status === 'REQUESTED' || s.status === 'ACCEPTED') swapsActive++;
      if (s.status === 'COMPLETED') swapsCompleted++;
    }

    const totalActive = buyingActive + sellingActive + borrowingActive + lendingActive + swapsActive;

    res.json({
      data: {
        totalActive,
        orders: {
          buyingActive,
          sellingActive,
          sellingNeedsShip,
          completed: ordersCompleted,
          total: orders.length,
        },
        rentals: {
          borrowingActive,
          lendingActive,
          completed: rentalsCompleted,
          total: rentals.length,
        },
        swaps: {
          active: swapsActive,
          completed: swapsCompleted,
          total: swaps.length,
        },
      },
    });
  } catch (e) {
    logger.error('getOrdersSummary failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate orders summary' });
  }
}

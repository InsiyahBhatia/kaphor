import { Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { AuthRequest } from '../middleware/auth';
import { emitToUser, emitToConversation } from '../lib/socket';
import { createNotification } from '../services/notification.service';
import { getDownloadUrl, uploadToS3 } from '../lib/s3';

// Helper to resolve media
async function resolveAvatar(avatar: string | null): Promise<string | null> {
  if (!avatar) return null;
  return getDownloadUrl(avatar);
}

async function resolveGarmentThumbnail(garment: any) {
  if (!garment || !garment.images || !garment.images.length) return garment;
  const firstImage = await getDownloadUrl(garment.images[0]);
  return { ...garment, image: firstImage };
}

// Anti-fraud/anti-phishing heuristic pattern
const OFF_PLATFORM_KEYWORDS = [
  /pay\s+(directly|direct|offline|outside)/i,
  /gpay\s+(me|to\s+\d{10})/i,
  /phonepe\s+(me|to\s+\d{10})/i,
  /paytm\s+(me|to\s+\d{10})/i,
  /send\s+(cash|crypto|usdt)/i,
  /whatsapp\s+(\+?\d{10,12})/i,
  /transfer\s+to\s+my\s+upi/i,
];

function checkOffPlatformRisk(content: string): boolean {
  return OFF_PLATFORM_KEYWORDS.some((regex) => regex.test(content));
}

/**
 * List all active conversations for the authenticated user.
 */
export async function listConversations(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const uid = req.user.id;

    const convs = await db.conversation.findMany({
      where: {
        OR: [{ participant1Id: uid }, { participant2Id: uid }],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participant1: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
            isVerified: true,
            verificationStatus: true,
            tier: true,
          },
        },
        participant2: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
            isVerified: true,
            verificationStatus: true,
            tier: true,
          },
        },
        garment: {
          select: {
            id: true,
            title: true,
            brand: true,
            images: true,
            price: true,
            rentalPriceDay: true,
            listingType: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const formatted = await Promise.all(
      convs.map(async (c: any) => {
        const otherUser = c.participant1Id === uid ? c.participant2 : c.participant1;
        const otherAvatar = await resolveAvatar(otherUser.avatar);

        let garmentData = null;
        if (c.garment) {
          garmentData = await resolveGarmentThumbnail(c.garment);
        }

        const unreadCount = await db.directMessage.count({
          where: {
            conversationId: c.id,
            recipientId: uid,
            readAt: null,
          },
        });

        // Find associated active order if any exists between these participants
        const activeOrder = await db.order.findFirst({
          where: {
            OR: [
              { buyerId: c.participant1Id, sellerId: c.participant2Id },
              { buyerId: c.participant2Id, sellerId: c.participant1Id },
            ],
            ...(c.garmentId ? { items: { some: { garmentId: c.garmentId } } } : {}),
            status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
        });

        return {
          id: c.id,
          otherUser: {
            ...otherUser,
            avatar: otherAvatar,
          },
          garment: garmentData,
          order: activeOrder,
          lastMessageText: c.lastMessageText || c.messages[0]?.content || '',
          lastMessageAt: c.lastMessageAt || c.createdAt,
          unreadCount,
          createdAt: c.createdAt,
        };
      })
    );

    // Sort by most recent activity (message time or creation time)
    formatted.sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
      const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    res.json({ data: formatted });
  } catch (error) {
    logger.error('listConversations failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load conversations' });
  }
}

/**
 * Get or initialize a conversation with another user (e.g. asking about a garment).
 */
export async function getOrCreateConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const uid = req.user.id;
    const { recipientId, garmentId } = req.body as { recipientId?: string; garmentId?: string };

    if (!recipientId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'recipientId is required' });
      return;
    }

    if (recipientId === uid) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot start conversation with yourself' });
      return;
    }

    // Check if conversation exists
    let conv = await db.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: uid, participant2Id: recipientId, garmentId: garmentId || null },
          { participant1Id: recipientId, participant2Id: uid, garmentId: garmentId || null },
        ],
      },
      include: {
        participant1: {
          select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
        },
        participant2: {
          select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
        },
        garment: {
          select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true },
        },
      },
    });

    if (!conv) {
      conv = await db.conversation.create({
        data: {
          participant1Id: uid,
          participant2Id: recipientId,
          garmentId: garmentId || null,
        },
        include: {
          participant1: {
            select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
          },
          participant2: {
            select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
          },
          garment: {
            select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true },
          },
        },
      });
    }

    const otherUser = conv.participant1Id === uid ? conv.participant2 : conv.participant1;
    const resolvedAvatar = await resolveAvatar(otherUser.avatar);
    const resolvedGarment = conv.garment ? await resolveGarmentThumbnail(conv.garment) : null;

    res.json({
      data: {
        id: conv.id,
        otherUser: {
          ...otherUser,
          avatar: resolvedAvatar,
        },
        garment: resolvedGarment,
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
      },
    });
  } catch (error) {
    logger.error('getOrCreateConversation failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to start conversation' });
  }
}

/**
 * Get messages inside a conversation.
 */
export async function getConversationMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { conversationId } = req.params;
    const uid = req.user.id;

    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
        participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
        garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
      },
    });

    if (!conv || (conv.participant1Id !== uid && conv.participant2Id !== uid)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    const messages = await db.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, displayName: true, username: true, avatar: true, isVerified: true },
        },
      },
    });

    // Mark unread messages sent to me as read
    await db.directMessage.updateMany({
      where: {
        conversationId,
        recipientId: uid,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    const otherUser = conv.participant1Id === uid ? conv.participant2 : conv.participant1;
    const resolvedOtherAvatar = await resolveAvatar(otherUser.avatar);
    const resolvedGarment = conv.garment ? await resolveGarmentThumbnail(conv.garment) : null;

    const resolvedMessages = await Promise.all(
      messages.map(async (m: any) => ({
        ...m,
        imageUrl: m.imageUrl ? await getDownloadUrl(m.imageUrl) : null,
        sender: {
          ...m.sender,
          avatar: await resolveAvatar(m.sender.avatar),
        },
      }))
    );

    // Find associated order between these users
    const associatedOrder = await db.order.findFirst({
      where: {
        OR: [
          { buyerId: conv.participant1Id, sellerId: conv.participant2Id },
          { buyerId: conv.participant2Id, sellerId: conv.participant1Id },
        ],
        ...(conv.garmentId ? { items: { some: { garmentId: conv.garmentId } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
      },
    });

    res.json({
      data: {
        conversation: {
          id: conv.id,
          otherUser: { ...otherUser, avatar: resolvedOtherAvatar },
          garment: resolvedGarment,
          order: associatedOrder,
        },
        messages: resolvedMessages,
      },
    });
  } catch (error) {
    logger.error('getConversationMessages failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load messages' });
  }
}

/**
 * Get or initialize a unified conversation for an existing Order.
 * Links buyer and seller directly to the unified conversation thread.
 */
export async function getOrCreateOrderConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const uid = req.user.id;
    const { orderId } = req.params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { garment: true },
        },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    if (order.buyerId !== uid && order.sellerId !== uid) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this order' });
      return;
    }

    const partnerId = order.buyerId === uid ? order.sellerId : order.buyerId;
    const firstGarmentId = order.items[0]?.garmentId || null;

    let conv = await db.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: uid, participant2Id: partnerId, garmentId: firstGarmentId },
          { participant1Id: partnerId, participant2Id: uid, garmentId: firstGarmentId },
          { participant1Id: uid, participant2Id: partnerId },
          { participant1Id: partnerId, participant2Id: uid },
        ],
      },
      include: {
        participant1: {
          select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
        },
        participant2: {
          select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
        },
        garment: {
          select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true },
        },
      },
    });

    if (!conv) {
      conv = await db.conversation.create({
        data: {
          participant1Id: order.buyerId,
          participant2Id: order.sellerId,
          garmentId: firstGarmentId,
        },
        include: {
          participant1: {
            select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
          },
          participant2: {
            select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true },
          },
          garment: {
            select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true },
          },
        },
      });
    }

    const otherUser = conv.participant1Id === uid ? conv.participant2 : conv.participant1;
    const resolvedAvatar = await resolveAvatar(otherUser.avatar);
    const resolvedGarment = conv.garment ? await resolveGarmentThumbnail(conv.garment) : null;

    res.json({
      data: {
        id: conv.id,
        otherUser: {
          ...otherUser,
          avatar: resolvedAvatar,
        },
        garment: resolvedGarment,
        order: {
          id: order.id,
          status: order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          createdAt: order.createdAt,
        },
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
      },
    });
  } catch (error) {
    logger.error('getOrCreateOrderConversation failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to access order conversation' });
  }
}

/**
 * Send a direct message in a conversation.
 */
export async function sendDirectMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { conversationId } = req.params;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    let imageUrl = typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim().length > 0 ? req.body.imageUrl.trim() : null;

    if ((!content && !imageUrl) || content.length > 4000) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Message must have content or an image (max 4000 chars)' });
      return;
    }

    const uid = req.user.id;
    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv || (conv.participant1Id !== uid && conv.participant2Id !== uid)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    const recipientId = conv.participant1Id === uid ? conv.participant2Id : conv.participant1Id;
    const isSuspicious = checkOffPlatformRisk(content);

    // If client sent base64 image data, upload to S3/local storage
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      try {
        const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadRes = await uploadToS3(buffer, 'messages', mimeType);
          imageUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        logger.warn('Failed to upload message image to storage, saving directly', { error: uploadErr });
      }
    }

    const msg = await db.directMessage.create({
      data: {
        conversationId,
        senderId: uid,
        recipientId,
        content: content || '📷 Photo',
        imageUrl,
        isFlagged: isSuspicious,
      },
      include: {
        sender: {
          select: { id: true, displayName: true, username: true, avatar: true, isVerified: true },
        },
      },
    });

    // Update conversation last message timestamp & preview
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: imageUrl && !content ? '📷 Photo' : content.slice(0, 100),
        lastMessageAt: new Date(),
      },
    });

    const resolvedSender = {
      ...msg.sender,
      avatar: await resolveAvatar(msg.sender.avatar),
    };
    const resolvedImageUrl = msg.imageUrl ? await getDownloadUrl(msg.imageUrl) : null;
    const outgoingData = { ...msg, imageUrl: resolvedImageUrl, sender: resolvedSender };

    // Emit live socket event to conversation room & recipient
    emitToConversation(conversationId, 'direct_message', outgoingData);
    emitToUser(recipientId, 'new_direct_message', {
      conversationId,
      message: outgoingData,
    });

    // Background push notification
    try {
      await createNotification({
        userId: recipientId,
        type: 'DIRECT_MESSAGE',
        title: `💬 New message from ${req.user.displayName}`,
        body: content.length > 80 ? content.slice(0, 77) + '...' : content,
        data: { conversationId, senderId: uid },
      });
    } catch (notifErr) {
      logger.warn('Failed to dispatch message notification', { error: notifErr });
    }

    res.status(201).json({
      data: outgoingData,
      warning: isSuspicious
        ? 'Notice: For your financial safety, keep all transactions within Kaphor to guarantee Buyer & Seller Protection.'
        : undefined,
    });
  } catch (error) {
    logger.error('sendDirectMessage failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to send message' });
  }
}

/**
 * Report a user for suspicious activity, spam, or fraud.
 */
export async function reportUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { userId } = req.params;
    const { reason, details } = req.body as { reason?: string; details?: string };

    if (!reason) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Report reason is required' });
      return;
    }

    if (userId === req.user.id) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot report yourself' });
      return;
    }

    const report = await db.userReport.create({
      data: {
        reporterId: req.user.id,
        reportedUserId: userId,
        reason,
        details: details?.slice(0, 1000),
      },
    });

    logger.warn('User report submitted', {
      reporterId: req.user.id,
      reportedUserId: userId,
      reason,
    });

    res.json({
      data: {
        id: report.id,
        message: 'Thank you for keeping Kaphor safe. Our Trust & Safety team will review this report.',
      },
    });
  } catch (error) {
    logger.error('reportUser failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to submit report' });
  }
}

import { Response } from 'express';
import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { cacheWrap, cacheClear } from '../lib/cache';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { AuthRequest } from '../middleware/auth';
import { emitToUser, emitToConversation } from '../lib/socket';
import { getDownloadUrl, uploadToCloudinary } from '../lib/cloudinary';
import { sendPushNotificationToUser } from '../services/pushNotification.service';

// Helper to resolve media
async function resolveAvatar(avatar: string | null): Promise<string | null> {
  if (!avatar) return null;
  return getDownloadUrl(avatar);
}

async function resolveGarmentThumbnail(garment: any, resolveAllImages: boolean = false) {
  if (!garment || !garment.images || !garment.images.length) return garment;
  if (!resolveAllImages) {
    const firstImage = garment.images[0] ? await getDownloadUrl(garment.images[0]) : null;
    return { ...garment, image: firstImage, images: [firstImage, ...garment.images.slice(1)] };
  }
  const resolvedImages = await Promise.all(garment.images.map((img: string) => getDownloadUrl(img)));
  const firstImage = resolvedImages[0] || null;
  return { ...garment, image: firstImage, images: resolvedImages };
}

const CONVERSATION_TYPES = ['SALE', 'SWAP', 'RENTAL', 'GENERAL'] as const;
const MAX_IMAGE_DATA_URI_LENGTH = 8 * 1024 * 1024;
const MAX_IMAGE_URL_LENGTH = 2048;
const REPORT_REASON_MAX = 100;
const REPORT_DETAILS_MAX = 1000;

function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64;
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
 * Unread direct messages per conversation for one user, from ONE grouped query.
 * Shared (and cached ~10 s) between the unread badge and the inbox list; cleared on any message write (see lib/prisma.ts).
 */
async function getUnreadByConversation(uid: string): Promise<Record<string, number>> {
  return cacheWrap(`inbox:unread:${uid}`, 10_000, async () => {
    const groups: any[] = await db.directMessage.groupBy({
      by: ['conversationId'],
      where: { recipientId: uid, readAt: null },
      _count: { id: true },
    });
    const out: Record<string, number> = {};
    for (const g of groups) out[g.conversationId] = g._count.id;
    return out;
  });
}

/**
 * Get total unread direct messages count for authenticated user.
 */
export async function getUnreadMessagesCount(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const byConversation = await getUnreadByConversation(req.user.id);
    const unreadCount = Object.values(byConversation).reduce((sum, n) => sum + n, 0);
    res.json({ unreadCount });
  } catch (error) {
    logger.error('getUnreadMessagesCount failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

const INBOX_USER_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatar: true,
  isVerified: true,
  verificationStatus: true,
  tier: true,
} as const;

/**
 * List active conversations for the authenticated user (inbox).
 * Pagination: ?limit=30 (max 100) and ?cursor=<last conversation id>; the response adds `nextCursor` (null at the end).
 */
export async function listConversations(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const uid = req.user.id;
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;
    const cursor = isId(req.query.cursor) ? (req.query.cursor as string) : undefined;

    const payload = await cacheWrap(`inbox:list:${uid}:${limit}:${cursor || ''}`, 12_000, async () => {
      const [rows, unreadMap] = await Promise.all([
        db.conversation.findMany({
          where: { OR: [{ participant1Id: uid }, { participant2Id: uid }] },
          orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
          take: limit + 1, // one extra row tells us whether another page exists
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            type: true,
            participant1Id: true,
            participant2Id: true,
            garmentId: true,
            orderId: true,
            swapId: true,
            rentalId: true,
            lastMessageText: true,
            lastMessageAt: true,
            createdAt: true,
            participant1: { select: INBOX_USER_SELECT },
            participant2: { select: INBOX_USER_SELECT },
            garment: {
              select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true },
            },
            order: { select: { id: true, status: true, totalAmount: true, currency: true, createdAt: true } },
            swap: {
              select: {
                id: true,
                status: true,
                offeredGarment: { select: { id: true, title: true, brand: true, images: true, price: true } },
                wantedGarment: { select: { id: true, title: true, brand: true, images: true, price: true } },
              },
            },
            rental: { select: { id: true, status: true, totalPrice: true, startDate: true, endDate: true } },
          },
        }),
        getUnreadByConversation(uid),
      ]);

      const hasMore = rows.length > limit;
      const convs: any[] = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? convs[convs.length - 1].id : null;

      // Side lookups are only for conversations that are NOT already linked to an order / swap / rental,
      // and only for the people on this page, instead of loading hundreds of rows for every user.
      const othersOf = (c: any) => (c.participant1Id === uid ? c.participant2Id : c.participant1Id);
      const unlinkedOthers = (pred: (c: any) => boolean) =>
        Array.from(new Set<string>(convs.filter(pred).map(othersOf)));
      const orderOthers = unlinkedOthers((c) => !c.orderId);
      const swapOthers = unlinkedOthers((c) => !c.swapId);
      const rentalOthers = unlinkedOthers((c) => !c.rentalId);

      const [activeOrders, activeSwaps, activeRentals]: [any[], any[], any[]] = await Promise.all([
        orderOthers.length
          ? db.order.findMany({
              where: {
                OR: [
                  { buyerId: uid, sellerId: { in: orderOthers } },
                  { sellerId: uid, buyerId: { in: orderOthers } },
                ],
                status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
              },
              orderBy: { createdAt: 'desc' },
              take: 100,
              select: {
                id: true,
                buyerId: true,
                sellerId: true,
                status: true,
                totalAmount: true,
                currency: true,
                createdAt: true,
                items: { select: { garmentId: true } },
              },
            })
          : [],
        swapOthers.length
          ? db.swap.findMany({
              where: {
                OR: [
                  { initiatorId: uid, receiverId: { in: swapOthers } },
                  { receiverId: uid, initiatorId: { in: swapOthers } },
                ],
                status: { notIn: ['CANCELLED', 'REJECTED'] },
              },
              orderBy: { updatedAt: 'desc' },
              take: 100,
              select: {
                id: true,
                initiatorId: true,
                receiverId: true,
                garmentOffered: true,
                garmentWanted: true,
                status: true,
                offeredGarment: { select: { id: true, title: true, brand: true, images: true, price: true } },
                wantedGarment: { select: { id: true, title: true, brand: true, images: true, price: true } },
              },
            })
          : [],
        rentalOthers.length
          ? db.rental.findMany({
              where: {
                OR: [
                  { renterId: uid, garment: { sellerId: { in: rentalOthers } } },
                  { renterId: { in: rentalOthers }, garment: { sellerId: uid } },
                ],
                status: { in: ['RESERVED', 'ACTIVE', 'RETURNED', 'COMPLETED'] },
              },
              orderBy: { updatedAt: 'desc' },
              take: 100,
              select: {
                id: true,
                renterId: true,
                garmentId: true,
                garment: { select: { sellerId: true } },
                status: true,
                totalPrice: true,
                startDate: true,
                endDate: true,
              },
            })
          : [],
      ]);

      // The stored lastMessageText is the snippet. Only reaction snippets (or legacy rows with no snippet) need the
      // most recent real message, and those are rare, so look them up individually instead of a subquery per row.
      const needsFallback = convs.filter((c) => !c.lastMessageText || c.lastMessageText.startsWith('[[REACTION:'));
      const fallbackMap = new Map<string, string>();
      await Promise.all(
        needsFallback.map(async (c) => {
          const m = await db.directMessage.findFirst({
            where: { conversationId: c.id, NOT: { content: { startsWith: '[[REACTION:' } } },
            orderBy: { createdAt: 'desc' },
            select: { content: true },
          });
          if (m?.content) fallbackMap.set(c.id, m.content);
        })
      );

    const avatarCache = new Map<string, Promise<string | null>>();
    const getCachedAvatar = (avatar: string | null) => {
      if (!avatar) return Promise.resolve(null);
      if (!avatarCache.has(avatar)) {
        avatarCache.set(avatar, resolveAvatar(avatar));
      }
      return avatarCache.get(avatar)!;
    };

    const formatted = await Promise.all(
      convs.map(async (c: any) => {
        const otherUser = c.participant1Id === uid ? c.participant2 : c.participant1;
        const otherAvatar = await getCachedAvatar(otherUser.avatar);

        let garmentData = null;
        if (c.garment) {
          garmentData = await resolveGarmentThumbnail(c.garment, false);
        }

        const unreadCount = unreadMap[c.id] || 0;

        // In-memory active order match without querying the database per conversation
        const activeOrder =
          c.order ||
          activeOrders.find(
            (o: any) =>
              ((o.buyerId === c.participant1Id && o.sellerId === c.participant2Id) ||
                (o.buyerId === c.participant2Id && o.sellerId === c.participant1Id)) &&
              (!c.garmentId || o.items.some((i: any) => i.garmentId === c.garmentId))
          ) ||
          null;

        const isExplicitSale =
          c.garment?.listingType === 'SALE' ||
          c.type === 'SALE' ||
          Boolean(c.orderId || activeOrder);

        const isExplicitRental =
          !isExplicitSale &&
          (c.garment?.listingType === 'RENTAL' || c.type === 'RENTAL' || Boolean(c.rentalId));

        const isExplicitSwap =
          !isExplicitSale &&
          !isExplicitRental &&
          (c.garment?.listingType === 'SWAP' ||
            c.garment?.listingType === 'ACCESSORY_SWAP' ||
            c.type === 'SWAP' ||
            Boolean(c.swapId));

        let activeSwap: any = null;
        let swapGarments: any[] = [];
        if (isExplicitSwap) {
          activeSwap =
            c.swap ||
            (c.swapId
              ? activeSwaps.find((s: any) => s.id === c.swapId)
              : activeSwaps.find(
                  (s: any) =>
                    ((s.initiatorId === c.participant1Id && s.receiverId === c.participant2Id) ||
                      (s.initiatorId === c.participant2Id && s.receiverId === c.participant1Id)) &&
                    (!c.garmentId || s.garmentOffered === c.garmentId || s.garmentWanted === c.garmentId)
                )) ||
            null;

          if (activeSwap) {
            const g1 = activeSwap.offeredGarment ? await resolveGarmentThumbnail(activeSwap.offeredGarment, false) : null;
            const g2 = activeSwap.wantedGarment ? await resolveGarmentThumbnail(activeSwap.wantedGarment, false) : null;
            swapGarments = [g1, g2].filter(Boolean);
          }
        }

        let activeRental: any = null;
        if (isExplicitRental || (!isExplicitSale && !isExplicitSwap)) {
          activeRental =
            c.rental ||
            (c.rentalId
              ? activeRentals.find((r: any) => r.id === c.rentalId)
              : activeRentals.find(
                  (r: any) =>
                    ((r.renterId === c.participant1Id && r.garment?.sellerId === c.participant2Id) ||
                      (r.renterId === c.participant2Id && r.garment?.sellerId === c.participant1Id)) &&
                    (!c.garmentId || r.garmentId === c.garmentId)
                )) ||
            null;
        }

        let rawSnippet = c.lastMessageText || fallbackMap.get(c.id) || '';
        let formattedSnippet = rawSnippet;
        if (rawSnippet.startsWith('[[REACTION:')) {
          const match = rawSnippet.match(/^\[\[REACTION:([^|]+)\|(.+)\]\]$/);
          const emoji = match ? match[2] : '❤️';
          const fallbackText = fallbackMap.get(c.id);
          if (fallbackText && !fallbackText.startsWith('[[REACTION:')) {
            const cleanFallback = fallbackText.replace(/^\[\[REPLY:[^\]]+\]\]\s*/, '');
            formattedSnippet = `Reacted ${emoji} to "${cleanFallback.slice(0, 30)}${cleanFallback.length > 30 ? '...' : ''}"`;
          } else {
            formattedSnippet = `Reacted ${emoji} to a message`;
          }
        } else {
          formattedSnippet = formattedSnippet.replace(/^\[\[REPLY:[^\]]+\]\]\s*/, '');
        }

        let resolvedType = c.type || 'SALE';
        if (isExplicitSale) {
          resolvedType = 'SALE';
        } else if (isExplicitRental || activeRental) {
          resolvedType = 'RENTAL';
        } else if (isExplicitSwap || activeSwap) {
          resolvedType = 'SWAP';
        } else if (/\b(rent|rental|lease|booking)\b/i.test(formattedSnippet)) {
          resolvedType = 'RENTAL';
        } else if (/\b(swap|trade|proposal)\b/i.test(formattedSnippet)) {
          resolvedType = 'SWAP';
        } else if (!c.garment && !c.orderId && !c.swapId && !c.rentalId) {
          resolvedType = c.type === 'GENERAL' ? 'GENERAL' : 'SALE';
        }

        return {
          id: c.id,
          type: resolvedType,
          orderId: c.orderId || activeOrder?.id || null,
          swapId: isExplicitSale ? null : (c.swapId || activeSwap?.id || null),
          rentalId: isExplicitSale ? null : (c.rentalId || activeRental?.id || null),
          otherUser: {
            ...otherUser,
            avatar: otherAvatar,
          },
          garment: garmentData,
          order: activeOrder,
          swap: isExplicitSale ? null : (activeSwap ? { id: activeSwap.id, status: activeSwap.status } : null),
          swapGarments: isExplicitSale ? [] : swapGarments,
          rental: isExplicitSale ? null : activeRental,
          lastMessageText: formattedSnippet,
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

      return { data: formatted, nextCursor };
    });

    res.json(payload);
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
    const { recipientId, garmentId, type, orderId, swapId, rentalId } = req.body as {
      recipientId?: string;
      garmentId?: string;
      type?: 'SALE' | 'SWAP' | 'RENTAL' | 'GENERAL';
      orderId?: string;
      swapId?: string;
      rentalId?: string;
    };

    if (!isId(recipientId)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'recipientId is required' });
      return;
    }
    for (const v of [garmentId, orderId, swapId, rentalId]) {
      if (v !== undefined && v !== null && !isId(v)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid identifier' });
        return;
      }
    }
    if (type !== undefined && type !== null && !(CONVERSATION_TYPES as readonly string[]).includes(type as string)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid conversation type' });
      return;
    }

    if (recipientId === uid) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot start conversation with yourself' });
      return;
    }

    const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { id: true, isActive: true } });
    if (!recipient || recipient.isActive === false) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Recipient not found' });
      return;
    }

    // Any transaction context linked to a conversation must involve exactly these two users.
    const bothIds = [uid, recipientId];
    if (orderId) {
      const o = await db.order.findUnique({ where: { id: orderId }, select: { buyerId: true, sellerId: true } });
      if (!o || !bothIds.includes(o.buyerId) || !bothIds.includes(o.sellerId)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this order' });
        return;
      }
    }
    if (swapId) {
      const s = await db.swap.findUnique({ where: { id: swapId }, select: { initiatorId: true, receiverId: true } });
      if (!s || !bothIds.includes(s.initiatorId) || !bothIds.includes(s.receiverId)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
        return;
      }
    }
    if (rentalId) {
      const r = await db.rental.findUnique({ where: { id: rentalId }, select: { renterId: true, garment: { select: { sellerId: true } } } });
      if (!r || !bothIds.includes(r.renterId) || !bothIds.includes(r.garment.sellerId)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this rental' });
        return;
      }
    }
    if (garmentId) {
      const gExists = await db.garment.findUnique({ where: { id: garmentId }, select: { id: true } });
      if (!gExists) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
        return;
      }
    }

    let initialType: 'SALE' | 'SWAP' | 'RENTAL' | 'GENERAL' = type || 'SALE';
    if (orderId) {
      initialType = 'SALE';
    } else if (swapId) {
      initialType = 'SWAP';
    } else if (rentalId) {
      initialType = 'RENTAL';
    } else if (garmentId) {
      const g = await db.garment.findUnique({ where: { id: garmentId }, select: { listingType: true } });
      if (g?.listingType === 'RENTAL') initialType = 'RENTAL';
      else if (g?.listingType === 'ACCESSORY_SWAP' || (g?.listingType as string) === 'SWAP') initialType = 'SWAP';
      else initialType = 'SALE';
    } else if (!type) {
      initialType = 'GENERAL';
    }

    // Context-specific conversation isolation:
    // If a garmentId is present or can be resolved from a transaction (rentalId, orderId, swapId),
    // always reuse the single conversation thread between the two participants for that garment.
    let targetGarmentId = garmentId || null;
    if (!targetGarmentId) {
      if (rentalId) {
        const r = await db.rental.findUnique({ where: { id: rentalId }, select: { garmentId: true } });
        if (r?.garmentId) targetGarmentId = r.garmentId;
      } else if (orderId) {
        const o = await db.order.findUnique({ where: { id: orderId }, select: { orderItems: { select: { garmentId: true }, take: 1 } } });
        if (o?.orderItems?.[0]?.garmentId) targetGarmentId = o.orderItems[0].garmentId;
      } else if (swapId) {
        const s = await db.swap.findUnique({ where: { id: swapId }, select: { wantedGarmentId: true, offeredGarmentId: true } });
        if (s?.wantedGarmentId) targetGarmentId = s.wantedGarmentId;
      }
    }

    let conv: any = null;

    if (targetGarmentId) {
      conv = await db.conversation.findFirst({
        where: {
          garmentId: targetGarmentId,
          OR: [
            { participant1Id: uid, participant2Id: recipientId },
            { participant1Id: recipientId, participant2Id: uid },
          ],
        },
        include: {
          participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (conv) {
        const updateData: any = {};
        if (orderId && conv.orderId !== orderId) updateData.orderId = orderId;
        if (rentalId && conv.rentalId !== rentalId) updateData.rentalId = rentalId;
        if (swapId && conv.swapId !== swapId) updateData.swapId = swapId;
        if (type && conv.type !== type) updateData.type = type;
        else if (initialType && initialType !== 'GENERAL' && conv.type !== initialType) updateData.type = initialType;

        if (Object.keys(updateData).length > 0) {
          conv = await db.conversation.update({
            where: { id: conv.id },
            data: updateData,
            include: {
              participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
              participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
              garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
            },
          });
        }
      }
    } else if (orderId) {
      conv = await db.conversation.findFirst({
        where: {
          orderId,
          OR: [
            { participant1Id: uid, participant2Id: recipientId },
            { participant1Id: recipientId, participant2Id: uid },
          ],
        },
        include: {
          participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
        },
      });
    } else if (swapId) {
      conv = await db.conversation.findFirst({
        where: {
          swapId,
          OR: [
            { participant1Id: uid, participant2Id: recipientId },
            { participant1Id: recipientId, participant2Id: uid },
          ],
        },
        include: {
          participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
        },
      });
    } else if (rentalId) {
      conv = await db.conversation.findFirst({
        where: {
          rentalId,
          OR: [
            { participant1Id: uid, participant2Id: recipientId },
            { participant1Id: recipientId, participant2Id: uid },
          ],
        },
        include: {
          participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
        },
      });
    } else {
      // General peer DM (no specific garment or transaction)
      conv = await db.conversation.findFirst({
        where: {
          garmentId: null,
          orderId: null,
          swapId: null,
          rentalId: null,
          OR: [
            { participant1Id: uid, participant2Id: recipientId },
            { participant1Id: recipientId, participant2Id: uid },
          ],
        },
        include: {
          participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true, verificationStatus: true } },
          garment: { select: { id: true, title: true, brand: true, images: true, price: true, rentalPriceDay: true, listingType: true } },
        },
      });
    }

    if (!conv) {
      conv = await db.conversation.create({
        data: {
          participant1Id: uid,
          participant2Id: recipientId,
          garmentId: targetGarmentId || null,
          type: initialType,
          orderId: orderId || null,
          swapId: swapId || null,
          rentalId: rentalId || null,
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
        type: conv.type,
        orderId: conv.orderId,
        swapId: conv.swapId,
        rentalId: conv.rentalId,
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

    // Mark unread as read in background without blocking payload completion
    db.directMessage
      .updateMany({
        where: {
          conversationId,
          recipientId: uid,
          readAt: null,
        },
        data: { readAt: new Date() },
      })
      .then(async (result: any) => {
        if (result.count > 0) {
          const remaining = await db.directMessage.count({
            where: { recipientId: uid, readAt: null },
          });
          emitToUser(uid, 'unread_messages_count_updated', { unreadCount: remaining });
        }
      })
      .catch((err: any) => logger.warn('Failed to update directMessage read status', { err }));

    const payload = await cacheWrap(`chat:conv:${conversationId}:${uid}`, 4_000, async () => {
      const conv = await db.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participant1: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
          participant2: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
          garment: {
            select: {
              id: true,
              title: true,
              brand: true,
              images: true,
              price: true,
              rentalPriceDay: true,
              rentalPriceWeek: true,
              listingType: true,
              category: true,
              size: true,
              condition: true,
              description: true,
              sellerId: true,
            },
          },
        },
      });

      if (!conv || (conv.participant1Id !== uid && conv.participant2Id !== uid)) {
        return null;
      }

      const otherUserId = conv.participant1Id === uid ? conv.participant2Id : conv.participant1Id;
      const otherUser = conv.participant1Id === uid ? conv.participant2 : conv.participant1;

      // Resolve avatars for the two participants once upfront
      const p1AvatarPromise = resolveAvatar(conv.participant1.avatar);
      const p2AvatarPromise = resolveAvatar(conv.participant2.avatar);

      // Most recent 50 messages only (bounded), returned oldest-first
      const messagesPromise = db.directMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          sender: {
            select: { id: true, displayName: true, username: true, avatar: true, isVerified: true },
          },
        },
      });

      const garmentSelectFields = {
        id: true,
        title: true,
        brand: true,
        images: true,
        price: true,
        rentalPriceDay: true,
        rentalPriceWeek: true,
        listingType: true,
        category: true,
        size: true,
        condition: true,
        description: true,
        sellerId: true,
      };

      const isConvSale =
        conv.type === 'SALE' ||
        conv.garment?.listingType === 'SALE' ||
        Boolean(conv.orderId);

      const isConvSwap =
        !isConvSale &&
        (conv.type === 'SWAP' ||
          Boolean(conv.swapId) ||
          conv.garment?.listingType === 'SWAP' ||
          conv.garment?.listingType === 'ACCESSORY_SWAP');

      const isConvRental =
        !isConvSale &&
        !isConvSwap &&
        (conv.type === 'RENTAL' ||
          Boolean(conv.rentalId) ||
          conv.garment?.listingType === 'RENTAL');

      // Find associated order only if sale context exists
      const orderPromise = conv.orderId
        ? db.order.findUnique({
            where: { id: conv.orderId },
            include: {
              items: {
                include: {
                  garment: {
                    select: garmentSelectFields,
                  },
                },
              },
            },
          })
        : isConvSale
        ? db.order.findFirst({
            where: {
              AND: [
                {
                  OR: [
                    { buyerId: conv.participant1Id, sellerId: conv.participant2Id },
                    { buyerId: conv.participant2Id, sellerId: conv.participant1Id },
                  ],
                },
                ...(conv.garmentId ? [{ items: { some: { garmentId: conv.garmentId } } }] : []),
              ],
            },
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: {
                  garment: {
                    select: garmentSelectFields,
                  },
                },
              },
            },
          })
        : Promise.resolve(null);

      const swapPromise = isConvSwap
        ? (conv.swapId
            ? db.swap.findUnique({
                where: { id: conv.swapId },
                select: { id: true, status: true, createdAt: true },
              })
            : db.swap.findFirst({
                where: {
                  AND: [
                    {
                      OR: [
                        { initiatorId: conv.participant1Id, receiverId: conv.participant2Id },
                        { initiatorId: conv.participant2Id, receiverId: conv.participant1Id },
                      ],
                    },
                    ...(conv.garmentId
                      ? [{ OR: [{ garmentOffered: conv.garmentId }, { garmentWanted: conv.garmentId }] }]
                      : []),
                    { status: { notIn: ['CANCELLED', 'REJECTED'] } },
                  ],
                },
                orderBy: { updatedAt: 'desc' },
                select: { id: true, status: true, createdAt: true },
              }))
        : Promise.resolve(null);

      const rentalPromise = isConvRental
        ? (conv.rentalId
            ? db.rental.findUnique({
                where: { id: conv.rentalId },
                include: {
                  garment: {
                    select: garmentSelectFields,
                  },
                },
              })
            : db.rental.findFirst({
                where: {
                  OR: [
                    { renterId: conv.participant1Id, garment: { sellerId: conv.participant2Id } },
                    { renterId: conv.participant2Id, garment: { sellerId: conv.participant1Id } },
                  ],
                  ...(conv.garmentId ? { garmentId: conv.garmentId } : {}),
                  status: {
                    in: [
                      'REQUESTED',
                      'APPROVED',
                      'RESERVED',
                      'DISPATCHED',
                      'ACTIVE',
                      'RETURN_DISPATCHED',
                      'RETURNED',
                      'COMPLETED',
                      'OVERDUE',
                    ],
                  },
                },
                orderBy: { updatedAt: 'desc' },
                include: {
                  garment: {
                    select: garmentSelectFields,
                  },
                },
              }))
        : Promise.resolve(null);

      const otherUserGarmentsPromise = db.garment.findMany({
        where: { sellerId: otherUserId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: garmentSelectFields,
      });

      const myGarmentsPromise = db.garment.findMany({
        where: { sellerId: uid, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: garmentSelectFields,
      });

      const [
        p1Avatar,
        p2Avatar,
        messages,
        associatedOrder,
        associatedSwap,
        associatedRental,
        otherUserGarments,
        myGarments,
      ] = await Promise.all([
        p1AvatarPromise,
        p2AvatarPromise,
        messagesPromise,
        orderPromise,
        swapPromise,
        rentalPromise,
        otherUserGarmentsPromise,
        myGarmentsPromise,
      ]);

      const avatarMap: Record<string, string | null> = {
        [conv.participant1Id]: p1Avatar,
        [conv.participant2Id]: p2Avatar,
      };
      const resolvedOtherAvatar = avatarMap[otherUser.id] || null;

      // Fast resolution: avatars are mapped synchronously, only message images need async resolution if present
      const resolvedMessages = await Promise.all(
        [...messages].reverse().map(async (m: any) => ({
          ...m,
          imageUrl: m.imageUrl ? await getDownloadUrl(m.imageUrl) : null,
          sender: {
            ...m.sender,
            avatar: avatarMap[m.senderId] ?? null,
          },
        }))
      );

      let activeGarment = (isConvRental && associatedRental?.garment) ? (associatedRental.garment as any) : conv.garment;
      if (!activeGarment && associatedRental?.garment) {
        activeGarment = associatedRental.garment as any;
      } else if (!activeGarment && associatedOrder?.items?.[0]?.garment) {
        activeGarment = associatedOrder.items[0].garment as any;
      }

      const [resolvedGarment, resolvedOtherGarments, resolvedMyGarments] = await Promise.all([
        activeGarment ? resolveGarmentThumbnail(activeGarment, true) : null,
        Promise.all(otherUserGarments.map((g: any) => resolveGarmentThumbnail(g, false))),
        Promise.all(myGarments.map((g: any) => resolveGarmentThumbnail(g, false))),
      ]);

      return {
        conversation: {
          id: conv.id,
          otherUser: { ...otherUser, avatar: resolvedOtherAvatar },
          garment: resolvedGarment,
          order: associatedOrder,
          swap: associatedSwap,
          rental: associatedRental,
          rentalId: conv.rentalId || associatedRental?.id || null,
          counterpartyGarments: resolvedOtherGarments,
          sellerGarments: resolvedMyGarments,
        },
        messages: resolvedMessages,
      };
    });

    if (!payload) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    res.json({ data: payload });
  } catch (error) {
    logger.error('getConversationMessages failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load messages' });
  }
}

/**
 * Link or update the active garment for a conversation thread.
 */
export async function linkConversationGarment(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { conversationId } = req.params;
    const rawGarmentId = req.body?.garmentId;
    const uid = req.user.id;

    if (rawGarmentId !== undefined && rawGarmentId !== null && rawGarmentId !== '' && !isId(rawGarmentId)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid garmentId' });
      return;
    }
    const garmentId: string | null = rawGarmentId || null;

    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv || (conv.participant1Id !== uid && conv.participant2Id !== uid)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    if (garmentId) {
      const g = await db.garment.findUnique({ where: { id: garmentId }, select: { sellerId: true } });
      if (!g || (g.sellerId !== conv.participant1Id && g.sellerId !== conv.participant2Id)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Garment does not belong to this conversation' });
        return;
      }
    }

    const updated = await db.conversation.update({
      where: { id: conversationId },
      data: { garmentId },
      include: {
        garment: {
          select: {
            id: true,
            title: true,
            brand: true,
            images: true,
            price: true,
            rentalPriceDay: true,
            rentalPriceWeek: true,
            listingType: true,
            category: true,
            size: true,
            condition: true,
            description: true,
            sellerId: true,
          },
        },
      },
    });

    const resolvedGarment = updated.garment ? await resolveGarmentThumbnail(updated.garment) : null;
    res.json({ data: { garment: resolvedGarment } });
  } catch (error) {
    logger.error('linkConversationGarment failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to link garment' });
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
          include: { garment: { select: GARMENT_LIST_COLUMNS } },
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

    if (conv) {
      if (!conv.orderId) {
        conv = await db.conversation.update({
          where: { id: conv.id },
          data: { orderId: order.id, type: 'SALE' },
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
    } else {
      conv = await db.conversation.create({
        data: {
          participant1Id: order.buyerId,
          participant2Id: order.sellerId,
          garmentId: firstGarmentId,
          orderId: order.id,
          type: 'SALE',
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
        type: 'SALE',
        orderId: order.id,
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
    if (imageUrl) {
      const isDataUri = imageUrl.startsWith('data:image/');
      if (isDataUri ? imageUrl.length > MAX_IMAGE_DATA_URI_LENGTH : imageUrl.length > MAX_IMAGE_URL_LENGTH) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Image is too large' });
        return;
      }
      if (!isDataUri && /^(javascript|data|file|vbscript):/i.test(imageUrl)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid image' });
        return;
      }
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
          const uploadRes = await uploadToCloudinary(buffer, 'messages', mimeType);
          imageUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        logger.warn('Failed to upload message image to storage', { error: uploadErr });
        res.status(502).json({ error: 'UPLOAD_FAILED', message: 'Failed to upload image' });
        return;
      }
      if (imageUrl.startsWith('data:')) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid image' });
        return;
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

    // Update conversation last message timestamp & preview (cleaning reply prefix or formatting reactions)
    let lastPreview = '';
    const isReaction = content.startsWith('[[REACTION:');
    if (isReaction) {
      const match = content.match(/^\[\[REACTION:([^|]+)\|(.+)\]\]$/);
      const targetId = match ? match[1] : null;
      const emoji = match ? match[2] : '❤️';
      if (targetId) {
        const targetMsg = await db.directMessage.findFirst({
          where: { id: targetId, conversationId },
          select: { content: true, imageUrl: true },
        });
        if (targetMsg?.content) {
          const cleanTarget = targetMsg.content.replace(/^\[\[REPLY:[^\]]+\]\]\s*/, '');
          lastPreview = `Reacted ${emoji} to "${cleanTarget.slice(0, 30)}${cleanTarget.length > 30 ? '...' : ''}"`;
        } else if (targetMsg?.imageUrl) {
          lastPreview = `Reacted ${emoji} to photo`;
        } else {
          lastPreview = `Reacted ${emoji} to a message`;
        }
      } else {
        lastPreview = `Reacted ${emoji} to a message`;
      }
    } else {
      const cleanPreview = content.replace(/^\[\[REPLY:[^\]]+\]\]\s*/, '');
      lastPreview = imageUrl && !cleanPreview ? '📷 Photo' : cleanPreview.slice(0, 100);
    }

    // Independent work: update the conversation preview while resolving media URLs.
    const [, senderAvatar, resolvedImageUrl] = await Promise.all([
      db.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageText: lastPreview,
          lastMessageAt: new Date(),
        },
        select: { id: true },
      }),
      resolveAvatar(msg.sender.avatar),
      msg.imageUrl ? getDownloadUrl(msg.imageUrl) : Promise.resolve(null),
    ]);
    const resolvedSender = {
      ...msg.sender,
      avatar: senderAvatar,
    };
    const outgoingData = { ...msg, imageUrl: resolvedImageUrl, sender: resolvedSender };

    // Emit live socket event to conversation room & recipient
    emitToConversation(conversationId, 'direct_message', outgoingData);
    emitToUser(recipientId, 'new_direct_message', {
      conversationId,
      message: outgoingData,
    });

    const recipientUnread = await db.directMessage.count({
      where: { recipientId, readAt: null },
    });
    emitToUser(recipientId, 'unread_messages_count_updated', { unreadCount: recipientUnread });

    // Send push notification to recipient's device (for normal messages, not reactions)
    if (!isReaction) {
      const senderName = msg.sender.displayName || msg.sender.username || 'Someone';
      const cleanPreview = content.replace(/^\[\[REPLY:[^\]]+\]\]\s*/, '');
      const messagePreview = cleanPreview || (imageUrl ? '📷 Sent a photo' : 'Sent you a message');
      sendPushNotificationToUser(
        recipientId,
        senderName,
        messagePreview,
        {
          type: 'DIRECT_MESSAGE',
          conversationId,
          url: `/messages/${conversationId}`,
        }
      ).catch(err => {
        logger.warn('Direct message push notification failed', { error: err });
      });
    }

    // Clear conversation cache for this thread so next fetch gets new message immediately
    cacheClear(`chat:conv:${conversationId}`);

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
    const rawReason = req.body?.reason;
    const rawDetails = req.body?.details;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    const details = typeof rawDetails === 'string' ? rawDetails.slice(0, REPORT_DETAILS_MAX) : undefined;

    if (!reason || reason.length > REPORT_REASON_MAX) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid report reason is required' });
      return;
    }

    if (userId === req.user.id) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot report yourself' });
      return;
    }

    if (!isId(userId)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid user id' });
      return;
    }
    const reported = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!reported) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const report = await db.userReport.create({
      data: {
        reporterId: req.user.id,
        reportedUserId: userId,
        reason,
        details,
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

/**
 * Delete a complete message thread / conversation for participants.
 */
export async function deleteConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { conversationId } = req.params;

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        participant1Id: true,
        participant2Id: true,
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    const isParticipant =
      conversation.participant1Id === req.user.id ||
      conversation.participant2Id === req.user.id;

    if (!isParticipant) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a participant in this conversation' });
      return;
    }

    // Explicitly delete all messages first, then the conversation (handles cases without DB cascade)
    await db.directMessage.deleteMany({ where: { conversationId } });
    await db.conversation.delete({ where: { id: conversationId } });
    cacheClear(`chat:conv:${conversationId}`);

    const otherParticipantId =
      conversation.participant1Id === req.user.id
        ? conversation.participant2Id
        : conversation.participant1Id;

    // Notify other participant and self via socket
    emitToUser(otherParticipantId, 'conversation_deleted', { conversationId });
    emitToUser(req.user.id, 'conversation_deleted', { conversationId });

    logger.info('Conversation deleted', { conversationId, deletedBy: req.user.id });

    res.json({
      data: {
        success: true,
        conversationId,
        message: 'Conversation and all messages deleted successfully',
      },
    });
  } catch (error) {
    logger.error('deleteConversation failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete conversation' });
  }
}


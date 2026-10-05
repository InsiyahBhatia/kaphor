import { Request, Response } from 'express';
import crypto from 'crypto';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitToUser, emitToConversation } from '../lib/socket';
import { getDownloadUrl } from '../lib/cloudinary';
import { createNotification } from '../services/notification.service';
import { cacheWrap } from '../lib/cache';
import { setPublicCache } from '../lib/httpCache';
import Razorpay from 'razorpay';
import {
  getSwapMetadata,
  updateSwapMetadata,
  SwapAddressData,
  SwapTrackingData,
} from '../services/swap-metadata.service';
import { getEstimatedGarmentValue } from '../utils/pricing';

const ALLOWED_SWAP_CATEGORIES = new Set([
  'accessory',
  'accessories',
  'bag',
  'bags',
  'jewelry',
  'jewellery',
  'watch',
  'watches',
  'belt',
  'belts',
  'scarf',
  'scarves',
  'eyewear',
  'sunglasses',
  'hat',
  'hats',
  'cap',
  'caps',
  'headwear',
  'hair accessories',
  'wallet',
  'wallets',
  'tie',
  'ties',
  'footwear',
  'shoes',
  'sneakers',
  'heels',
  'boots',
  'dress shoes',
  'sandals',
  'flats',
  'traditionals',
  'juttis',
]);

/** Trim + length-cap a string field; returns undefined if not a non-empty string. */
function cleanStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : undefined;
}

/**
 * Completes a swap exactly once: status-guarded (ACCEPTED -> COMPLETED) so concurrent or
 * repeated calls cannot double-transfer ownership or double-release the deposit.
 * Returns false if another call already completed (or cancelled) the swap.
 */
async function finalizeSwapOnce(id: string, swap: any): Promise<boolean> {
  const done: boolean = await (db as any).$transaction(async (tx: any) => {
    const r = await tx.swap.updateMany({
      where: { id, status: 'ACCEPTED' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (r.count !== 1) return false;

    // Offered garment moves to receiver; wanted garment moves to initiator
    const a = await tx.garment.updateMany({
      where: { id: swap.garmentOffered, sellerId: swap.initiatorId },
      data: { sellerId: swap.receiverId, lifecycleState: 'OWNERSHIP', isActive: false },
    });
    const b = await tx.garment.updateMany({
      where: { id: swap.garmentWanted, sellerId: swap.receiverId },
      data: { sellerId: swap.initiatorId, lifecycleState: 'OWNERSHIP', isActive: false },
    });
    if (a.count !== 1 || b.count !== 1) {
      throw new Error('SWAP_OWNERSHIP_MISMATCH');
    }

    const carbonSaved = 10;
    const waterSaved = 1000;
    for (const uid of [swap.initiatorId, swap.receiverId]) {
      await tx.impactRecord.upsert({
        where: { userId: uid },
        update: { itemsCirculated: { increment: 1 }, carbonSavedKg: { increment: carbonSaved }, waterSavedL: { increment: waterSaved } },
        create: { userId: uid, itemsCirculated: 1, carbonSavedKg: carbonSaved, waterSavedL: waterSaved },
      });
    }
    return true;
  });
  if (done) {
    await updateSwapMetadata(id, (m) => {
      m.initiatorReceived = true;
      m.receiverReceived = true;
      if (!m.depositReleasedAt) m.depositReleasedAt = new Date().toISOString();
    });
  }
  return done;
}

function normalizeCategory(category: string | null | undefined): string {
  return (category ?? '').trim().toLowerCase();
}

function isAccessoryGarment(garment: any): boolean {
  if (!garment) return false;
  if ((garment as any).isAccessory === true) return true;
  if (garment.listingType === 'ACCESSORY_SWAP') return true;
  const cat = normalizeCategory(garment.category);
  const sub = normalizeCategory(garment.subCategory);
  return (
    ALLOWED_SWAP_CATEGORIES.has(cat) ||
    ALLOWED_SWAP_CATEGORIES.has(sub) ||
    Array.from(ALLOWED_SWAP_CATEGORIES).some((t) => cat.includes(t) || sub.includes(t))
  );
}

const SWAP_GARMENT_SELECT = {
  id: true,
  title: true,
  brand: true,
  images: true,
  category: true,
  subCategory: true,
  size: true,
  condition: true,
  price: true,
  listingType: true,
  sellerId: true,
} as const;

/** Format garment into clean snapshot for swap UI */
function toGarmentSnapshot(g: any, resolvedFirstImage?: string): any {
  if (!g) return undefined;
  const img = resolvedFirstImage || (g.images && g.images[0]) || g.primaryImage || g.image || '';
  return {
    id: g.id,
    title: g.title,
    brand: g.brand || 'Unknown',
    primaryImage: img,
    image: img,
    images: img ? [img, ...(g.images || []).slice(1)] : (g.images || []),
    category: g.category,
    size: g.size,
    condition: g.condition,
    price: g.price && g.price > 0 ? g.price : getEstimatedGarmentValue(g.category, g.brand),
    estimatedValue: g.price && g.price > 0 ? g.price : getEstimatedGarmentValue(g.category, g.brand), // in Rupees
  };
}

/** Transform internal swap + metadata into client SwapTransaction */
async function formatSwapTransaction(swap: any, currentUserId?: string, resolvedImages?: Record<string, string>): Promise<any> {
  const meta = await getSwapMetadata(swap.id, swap.metadata);

  // Compute composite status
  let compositeStatus = swap.status;
  if (meta.dispute && meta.dispute.status === 'OPEN') {
    compositeStatus = 'DISPUTED';
  } else if (meta.cancelledAt || swap.status === 'REJECTED') {
    compositeStatus = 'CANCELLED';
  } else if (swap.status === 'ACCEPTED') {
    const bothAgreed = meta.initiatorAcceptedTerms && meta.receiverAcceptedTerms;
    const bothAddressed = !!(meta.initiatorAddress && meta.receiverAddress);
    const bothShipped = !!(meta.initiatorTracking && meta.receiverTracking);
    const oneShipped = !!(meta.initiatorTracking || meta.receiverTracking);
    const bothReceived = meta.initiatorReceived && meta.receiverReceived;
    const oneReceived = meta.initiatorReceived || meta.receiverReceived;

    if (bothReceived) {
      compositeStatus = 'COMPLETED';
    } else if (oneReceived) {
      compositeStatus = 'DELIVERED';
    } else if (bothShipped) {
      compositeStatus = 'BOTH_SHIPPED';
    } else if (oneShipped) {
      compositeStatus = 'SHIPPED';
    } else if (bothAddressed) {
      compositeStatus = 'ADDRESS_SHARED';
    } else if (bothAgreed) {
      compositeStatus = 'AGREEMENT_SIGNED';
    } else {
      compositeStatus = 'AGREEMENT_PENDING';
    }
  }

  const isInitiator = currentUserId === swap.initiatorId;
  const isReceiver = currentUserId === swap.receiverId;
  const bothSigned = !!(meta.initiatorAcceptedTerms && meta.receiverAcceptedTerms);

  let offeredImg = resolvedImages?.[swap.offeredGarment?.images?.[0]];
  if (!offeredImg && swap.offeredGarment?.images?.[0]) {
    offeredImg = await getDownloadUrl(swap.offeredGarment.images[0]);
  }

  let wantedImg = resolvedImages?.[swap.wantedGarment?.images?.[0]];
  if (!wantedImg && swap.wantedGarment?.images?.[0]) {
    wantedImg = await getDownloadUrl(swap.wantedGarment.images[0]);
  }

  const offeredSnapshot = toGarmentSnapshot(swap.offeredGarment, offeredImg);
  const wantedSnapshot = toGarmentSnapshot(swap.wantedGarment, wantedImg);

  let initiatorAvatar = swap.initiator?.avatar;
  if (initiatorAvatar) {
    initiatorAvatar = await getDownloadUrl(initiatorAvatar);
  }
  let receiverAvatar = swap.receiver?.avatar;
  if (receiverAvatar) {
    receiverAvatar = await getDownloadUrl(receiverAvatar);
  }

  return {
    id: swap.id,
    initiatorId: swap.initiatorId,
    receiverId: swap.receiverId,
    status: compositeStatus,

    garmentOfferedId: swap.garmentOffered,
    garmentWantedId: swap.garmentWanted,
    garmentOffered: offeredSnapshot,
    garmentWanted: wantedSnapshot,
    offeredGarment: offeredSnapshot,
    wantedGarment: wantedSnapshot,

    agreementSignedAt: meta.termsAcceptedAt,
    initiatorAcceptedTerms: !!meta.initiatorAcceptedTerms,
    receiverAcceptedTerms: !!meta.receiverAcceptedTerms,
    termsAcceptedAt: meta.termsAcceptedAt,

    // Address privacy: only visible if both signed
    initiatorAddress: bothSigned || isInitiator ? meta.initiatorAddress : undefined,
    receiverAddress: bothSigned || isReceiver ? meta.receiverAddress : undefined,
    addressSharedAt: meta.addressSharedAt,

    initiatorTracking: meta.initiatorTracking,
    receiverTracking: meta.receiverTracking,

    initiatorReceived: !!meta.initiatorReceived,
    receiverReceived: !!meta.receiverReceived,

    securityDepositAmount: meta.securityDepositAmount || 500,
    securityDepositPaidBy: meta.securityDepositPaidBy,
    depositEscrowId: meta.depositEscrowId,
    depositReleasedAt: meta.depositReleasedAt,
    swapFee: meta.swapFee || 250,

    conditionPhotos: meta.conditionPhotos,

    createdAt: swap.createdAt instanceof Date ? swap.createdAt.toISOString() : swap.createdAt,
    completedAt: swap.completedAt ? (swap.completedAt instanceof Date ? swap.completedAt.toISOString() : swap.completedAt) : undefined,
    disputedAt: meta.disputedAt,
    disputeReason: meta.disputeReason,
    disputeResolution: meta.disputeResolution,
    message: swap.message,
    reviews: meta.reviews,

    initiator: swap.initiator ? { ...swap.initiator, avatar: initiatorAvatar } : swap.initiator,
    receiver: swap.receiver ? { ...swap.receiver, avatar: receiverAvatar } : swap.receiver,
  };
}

/** Batch resolve media URLs */
async function resolveSwapMediaBatch(swaps: any[]): Promise<Record<string, string>> {
  const imageUrls = new Set<string>();
  for (const swap of swaps) {
    if (swap.offeredGarment?.images?.length) imageUrls.add(swap.offeredGarment.images[0]);
    if (swap.wantedGarment?.images?.length) imageUrls.add(swap.wantedGarment.images[0]);
  }

  const imageMap = await Promise.all(
    Array.from(imageUrls).map(async (url) => ({ url, resolved: await getDownloadUrl(url) }))
  );

  return Object.fromEntries(imageMap.map((r) => [r.url, r.resolved]));
}

/**
 * GET /swaps/feed
 * Discover available swappable accessories.
 */
export async function getSwapFeed(req: Request, res: Response): Promise<void> {
  try {
    const { category, limit = '20' } = req.query;
    const take = Math.min(Math.max(1, Number(limit) || 20), 50);

    const cacheKey = `swaps:feed:${category || 'all'}:${take}:${req.user?.id || 'anon'}`;
    const payload = await cacheWrap(cacheKey, 30_000, async () => {
      const where: any = {
        listingType: 'ACCESSORY_SWAP',
        isActive: true,
        lifecycleState: 'LISTED',
      };

      if (req.user) {
        where.sellerId = { not: req.user.id };
      }

      if (category) {
        where.category = String(category);
      }

      const garments = await db.garment.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          brand: true,
          category: true,
          subCategory: true,
          size: true,
          color: true,
          condition: true,
          images: true,
          price: true,
          listingType: true,
          lifecycleState: true,
          sellerId: true,
          createdAt: true,
          seller: { select: { id: true, displayName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });

      const accessoryGarments = garments.filter((g: any) => isAccessoryGarment(g));

      const resolved = await Promise.all(
        accessoryGarments.map(async (g: any) => {
          const img = g.images?.length ? await getDownloadUrl(g.images[0]) : null;
          const avatar = g.seller?.avatar ? await getDownloadUrl(g.seller.avatar) : g.seller?.avatar;
          const price = g.price && g.price > 0 ? g.price : getEstimatedGarmentValue(g.category, g.brand);
          return {
            ...g,
            price,
            estimatedValue: price,
            images: img ? [img, ...g.images.slice(1)] : g.images,
            seller: g.seller ? { ...g.seller, avatar } : g.seller,
          };
        })
      );

      return { data: resolved };
    });

    setPublicCache(req, res, 30);
    res.json(payload);
  } catch (error) {
    logger.error('getSwapFeed failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /swaps
 * List all swaps for the current user.
 */
export async function getSwaps(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const userId = req.user.id;

    const swaps = await db.swap.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        // Only the fields the swap snapshot uses (skips garmentVector and other heavy columns).
        offeredGarment: { select: SWAP_GARMENT_SELECT },
        wantedGarment: { select: SWAP_GARMENT_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const imageLookup = await resolveSwapMediaBatch(swaps);
    const formatted = await Promise.all(swaps.map((s: any) => formatSwapTransaction(s, userId, imageLookup)));

    res.json({ data: formatted });
  } catch (error) {
    logger.error('Failed to fetch swaps', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /swaps/:id
 * Get single swap detail with agreement, address, and tracking status.
 */
export async function getSwapById(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Swap not found' });
      return;
    }

    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
      return;
    }

    const imageLookup = await resolveSwapMediaBatch([swap]);
    const formatted = await formatSwapTransaction(swap, req.user.id, imageLookup);

    res.json({ data: formatted });
  } catch (error) {
    logger.error('getSwapById failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps
 * Create a new swap request.
 */
export async function createSwapRequest(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { garmentOfferedId, garmentWantedId, conditionPhotos } = req.body || {};
    const message = cleanStr(req.body?.message, 1000);
    const initiatorId = req.user.id;

    if (!garmentOfferedId || !garmentWantedId || typeof garmentOfferedId !== 'string' || typeof garmentWantedId !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Both garments are required' });
      return;
    }

    const offeredGarment = await db.garment.findUnique({ where: { id: String(garmentOfferedId) } });
    const wantedGarment = await db.garment.findUnique({ where: { id: String(garmentWantedId) } });

    if (!offeredGarment || !wantedGarment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment(s) not found' });
      return;
    }

    if (offeredGarment.sellerId !== initiatorId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own the offered garment' });
      return;
    }
    if (wantedGarment.sellerId === initiatorId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot swap with your own garment' });
      return;
    }

    // Validate Accessory Constraint
    if (!isAccessoryGarment(offeredGarment) || !isAccessoryGarment(wantedGarment)) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Swapping is strictly reserved for Accessories (bags, jewelry, belts, scarves, footwear).',
      });
      return;
    }

    // Validate ListingType and State
    if (offeredGarment.listingType !== 'ACCESSORY_SWAP' || wantedGarment.listingType !== 'ACCESSORY_SWAP') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Both garments must be listed for swap' });
      return;
    }
    if (!offeredGarment.isActive || !wantedGarment.isActive) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'One or both garments are no longer active' });
      return;
    }
    if (offeredGarment.lifecycleState !== 'LISTED' || wantedGarment.lifecycleState !== 'LISTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'One or both garments are not available for swap' });
      return;
    }

    // Prevent duplicate open proposals for the same pair
    const existingSwap = await db.swap.findFirst({
      where: {
        initiatorId,
        garmentOffered: offeredGarment.id,
        garmentWanted: wantedGarment.id,
        status: { in: ['REQUESTED', 'ACCEPTED'] },
      },
      select: { id: true },
    });
    if (existingSwap) {
      res.status(409).json({ error: 'CONFLICT', message: 'A swap proposal for these items is already open' });
      return;
    }

    // Create Swap in DB
    const swap = await db.swap.create({
      data: {
        initiatorId,
        receiverId: wantedGarment.sellerId,
        garmentOffered: offeredGarment.id,
        garmentWanted: wantedGarment.id,
        message: message || null,
        status: 'REQUESTED',
      },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    // Save initial metadata (cap count and size to keep the JSONB payload sane)
    if (Array.isArray(conditionPhotos) && conditionPhotos.length > 0) {
      const safePhotos = conditionPhotos
        .filter((p: any) => typeof p === 'string' && p.length > 0 && p.length <= 40000)
        .slice(0, 3);
      if (safePhotos.length > 0) {
        await updateSwapMetadata(swap.id, (meta) => {
          meta.conditionPhotos = {
            offeredPhotos: safePhotos,
            wantedPhotos: [],
          };
        });
      }
    }

    // Real-time socket notification
    emitToUser(wantedGarment.sellerId, 'swap:request_received', {
      swapId: swap.id,
      message: 'You have a new accessory swap request!',
    });

    // In-app Notification
    try {
      await createNotification({
        userId: wantedGarment.sellerId,
        type: 'SWAP_REQUEST',
        title: 'New Swap Proposal! ⚖️',
        body: `${(req.user as any)?.displayName || req.user.email || 'A collector'} proposed swapping for your "${wantedGarment.title}". Review valuations and chat.`,
        data: { swapId: swap.id, targetRoute: `/(tabs)/swap/details?swapId=${swap.id}` },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap request notification', { error: notifErr });
    }

    // ── Create or link conversation in direct chat so swap message is immediately visible ──
    let conversationId: string | undefined;
    try {
      let conv = await db.conversation.findFirst({
        where: {
          garmentId: wantedGarment.id,
          OR: [
            { participant1Id: initiatorId, participant2Id: wantedGarment.sellerId },
            { participant1Id: wantedGarment.sellerId, participant2Id: initiatorId },
          ],
        },
      });

      if (conv) {
        await db.conversation.update({
          where: { id: conv.id },
          data: { swapId: swap.id, type: 'SWAP' },
        });
      } else {
        conv = await db.conversation.create({
          data: {
            participant1Id: initiatorId,
            participant2Id: wantedGarment.sellerId,
            garmentId: wantedGarment.id,
            swapId: swap.id,
            type: 'SWAP',
          },
        });
      }

      conversationId = conv.id;

      // Construct proposal message text
      const cleanCustomMessage = typeof message === 'string' && message.trim().length > 0 ? message.trim() : null;
      const proposalText = cleanCustomMessage
        ? `🤝 [SWAP PROPOSAL] ${cleanCustomMessage}\n\n• Offered: ${offeredGarment.title}\n• Requested: ${wantedGarment.title}`
        : `🤝 [SWAP PROPOSAL] Proposed swapping "${offeredGarment.title}" for your "${wantedGarment.title}".`;

      const directMsg = await db.directMessage.create({
        data: {
          conversationId: conv.id,
          senderId: initiatorId,
          recipientId: wantedGarment.sellerId,
          content: proposalText,
        },
        include: {
          sender: {
            select: { id: true, displayName: true, username: true, avatar: true, isVerified: true },
          },
        },
      });

      await db.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageText: proposalText.slice(0, 100),
          lastMessageAt: new Date(),
          garmentId: conv.garmentId || wantedGarment.id,
        },
      });

      // Emit live socket event to conversation room & both users
      emitToConversation(conv.id, 'direct_message', directMsg);
      emitToUser(wantedGarment.sellerId, 'new_direct_message', {
        conversationId: conv.id,
        message: directMsg,
      });
      emitToUser(initiatorId, 'new_direct_message', {
        conversationId: conv.id,
        message: directMsg,
      });
    } catch (chatErr) {
      logger.warn('Failed to link swap request to direct conversation', { error: chatErr });
    }

    const formatted = await formatSwapTransaction(swap, initiatorId);
    res.status(201).json({
      data: {
        ...formatted,
        conversationId,
      },
    });
  } catch (error) {
    logger.error('Failed to create swap request', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to process swap request' });
  }
}

/**
 * PATCH /swaps/:id
 * Respond to a swap proposal (Accept / Decline).
 */
export async function respondToSwap(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const body = req.body || {};

    // Support both { action: 'ACCEPTED' | 'REJECTED' } and { accept: boolean }
    const isAccepted = body.action === 'ACCEPTED' || body.accept === true;
    const isRejected = body.action === 'REJECTED' || body.accept === false;

    if (!isAccepted && !isRejected) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid action (ACCEPTED or REJECTED) is required' });
      return;
    }

    const swap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Swap not found' });
      return;
    }

    if (swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to respond to this swap' });
      return;
    }

    if (swap.status !== 'REQUESTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap proposal is no longer pending' });
      return;
    }

    if (isAccepted) {
      if (!swap.offeredGarment?.isActive || !swap.wantedGarment?.isActive ||
          swap.offeredGarment.sellerId !== swap.initiatorId || swap.wantedGarment.sellerId !== swap.receiverId) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'One or both garments are no longer available' });
        return;
      }
      const won = await (db as any).$transaction(async (tx: any) => {
        const r = await tx.swap.updateMany({
          where: { id, status: 'REQUESTED', receiverId: req.user!.id },
          data: { status: 'ACCEPTED' },
        });
        if (r.count !== 1) return false;

        // Reserve garments so they cannot be purchased while swap is underway
        await tx.garment.updateMany({
          where: { id: { in: [swap.garmentOffered, swap.garmentWanted] } },
          data: { isActive: false },
        });
        return true;
      });
      if (!won) {
        res.status(409).json({ error: 'CONFLICT', message: 'Swap proposal is no longer pending' });
        return;
      }

      emitToUser(swap.initiatorId, 'swap:accepted', { swapId: swap.id });

      try {
        await createNotification({
          userId: swap.initiatorId,
          type: 'SWAP_ACCEPTED',
          title: 'Swap Accepted! 🎉',
          body: `Your swap proposal for "${swap.wantedGarment?.title || 'item'}" was accepted! Review trade values and chat with partner.`,
          data: { swapId: swap.id, targetRoute: `/(tabs)/swap/details?swapId=${swap.id}` },
        });
      } catch (notifErr) {
        logger.warn('Failed to send swap accepted notification', { error: notifErr });
      }

      // Post acceptance notification message to direct conversation thread
      try {
        let conv = await db.conversation.findFirst({
          where: { swapId: swap.id },
        });
        if (!conv) {
          conv = await db.conversation.findFirst({
            where: {
              OR: [
                { participant1Id: swap.initiatorId, participant2Id: swap.receiverId },
                { participant1Id: swap.receiverId, participant2Id: swap.initiatorId },
              ],
            },
          });
        }
        if (conv) {
          const acceptText = `🎉 [SWAP ACCEPTED] I accepted your swap proposal! Next step: review & sign the swap agreement.`;
          const acceptMsg = await db.directMessage.create({
            data: {
              conversationId: conv.id,
              senderId: req.user.id,
              recipientId: swap.initiatorId,
              content: acceptText,
            },
            include: {
              sender: {
                select: { id: true, displayName: true, username: true, avatar: true, isVerified: true },
              },
            },
          });
          await db.conversation.update({
            where: { id: conv.id },
            data: {
              lastMessageText: acceptText.slice(0, 100),
              lastMessageAt: new Date(),
            },
          });
          emitToConversation(conv.id, 'direct_message', acceptMsg);
          emitToUser(swap.initiatorId, 'new_direct_message', {
            conversationId: conv.id,
            message: acceptMsg,
          });
        }
      } catch (err) {
        logger.warn('Failed to post accept message to conversation', { error: err });
      }
    } else {
      const rej = await db.swap.updateMany({
        where: { id, status: 'REQUESTED', receiverId: req.user.id },
        data: { status: 'REJECTED' },
      });
      if (rej.count !== 1) {
        res.status(409).json({ error: 'CONFLICT', message: 'Swap proposal is no longer pending' });
        return;
      }

      emitToUser(swap.initiatorId, 'swap:rejected', { swapId: swap.id });

      try {
        await createNotification({
          userId: swap.initiatorId,
          type: 'SWAP_REJECTED',
          title: 'Swap Declined',
          body: `Your swap proposal was declined.`,
          data: { swapId: swap.id },
        });
      } catch (notifErr) {
        logger.warn('Failed to send swap rejected notification', { error: notifErr });
      }

      // Post decline notification message to direct conversation thread
      try {
        let conv = await db.conversation.findFirst({
          where: { swapId: swap.id },
        });
        if (!conv) {
          conv = await db.conversation.findFirst({
            where: {
              OR: [
                { participant1Id: swap.initiatorId, participant2Id: swap.receiverId },
                { participant1Id: swap.receiverId, participant2Id: swap.initiatorId },
              ],
            },
          });
        }
        if (conv) {
          const declineText = `❌ [SWAP DECLINED] I have declined this swap proposal.`;
          const declineMsg = await db.directMessage.create({
            data: {
              conversationId: conv.id,
              senderId: req.user.id,
              recipientId: swap.initiatorId,
              content: declineText,
            },
            include: {
              sender: {
                select: { id: true, displayName: true, username: true, avatar: true, isVerified: true },
              },
            },
          });
          await db.conversation.update({
            where: { id: conv.id },
            data: {
              lastMessageText: declineText.slice(0, 100),
              lastMessageAt: new Date(),
            },
          });
          emitToConversation(conv.id, 'direct_message', declineMsg);
          emitToUser(swap.initiatorId, 'new_direct_message', {
            conversationId: conv.id,
            message: declineMsg,
          });
        }
      } catch (err) {
        logger.warn('Failed to post decline message to conversation', { error: err });
      }
    }

    const updated = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    const formatted = await formatSwapTransaction(updated, req.user.id);
    res.json({ data: formatted });
  } catch (error) {
    logger.error('Failed to respond to swap', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/sign-agreement
 * Digital signature acceptance for mutual terms.
 */
export async function signSwapAgreement(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({ where: { id } });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Agreement can only be signed on an accepted swap' });
      return;
    }

    const isInitiator = swap.initiatorId === req.user.id;

    const meta = await updateSwapMetadata(id, (meta) => {
      if (isInitiator) {
        meta.initiatorAcceptedTerms = true;
      } else {
        meta.receiverAcceptedTerms = true;
      }
      if (meta.initiatorAcceptedTerms && meta.receiverAcceptedTerms) {
        meta.termsAcceptedAt = new Date().toISOString();
      }
    });

    if (meta.initiatorAcceptedTerms && meta.receiverAcceptedTerms) {
      emitToUser(swap.initiatorId, 'swap:agreement_ready', { swapId: id });
      emitToUser(swap.receiverId, 'swap:agreement_ready', { swapId: id });
    }

    const fullSwap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    res.json({ data: await formatSwapTransaction(fullSwap, req.user.id) });
  } catch (error) {
    logger.error('signSwapAgreement failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /swaps/:id/agreement
 */
export async function getSwapAgreement(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const { id } = req.params;
    const agSwap = await db.swap.findUnique({ where: { id }, select: { initiatorId: true, receiverId: true } });
    if (!agSwap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (agSwap.initiatorId !== req.user.id && agSwap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    const meta = await getSwapMetadata(id);
    res.json({
      data: {
        swapId: id,
        terms: [
          'Item Authenticity & Condition: I warrant that the item I am offering strictly matches the photos, condition, brand, and description in my listing.',
          'Platform Non-Liability (All Transactions): I acknowledge that Kaphor operates solely as an electronic intermediary under Section 79 of the Information Technology Act, 2000 and is NOT RESPONSIBLE or liable for any transaction in swapping, rental, buying, or selling.',
          'Direct User Contract: I understand that all transactions (swaps, rentals, purchases, and sales) are direct bipartite contracts between users, and Kaphor is not a party, guarantor, or merchant of the goods.',
          'Dispatch & Tracking: I agree to securely package and dispatch the item with valid courier tracking within 3 business days of signing.',
          'Escrow & Security Deposit: I acknowledge that a security deposit of ₹500 is held in automated escrow and released after mutual delivery confirmation.',
          'Dispute Window & Evidence: I agree that any claim regarding damaged or materially different goods must be opened with unboxing evidence within 48 hours of delivery.',
          'Indemnification & Indian Law: I agree to indemnify and hold harmless Kaphor from any claims arising from my listing or transaction, and agree that Indian law and Indian courts govern this agreement.',
        ],
        disclaimer: {
          title: 'INTERMEDIARY SAFE HARBOUR & PLATFORM NON-LIABILITY (INDIAN LAW)',
          statutoryReference: 'Information Technology Act, 2000 (Section 79) • Consumer Protection (E-Commerce) Rules, 2020 • Indian Contract Act, 1872',
          summary: 'Kaphor operates strictly as a peer-to-peer technology facilitator and electronic intermediary under Section 79 of the Information Technology Act, 2000. Kaphor is not a party to any contract, sale, exchange, rental, or purchase between users, and does not manufacture, inspect, warrant, or hold title to any listed goods.',
        },
        acceptedByInitiator: !!meta.initiatorAcceptedTerms,
        acceptedByReceiver: !!meta.receiverAcceptedTerms,
        signedAt: meta.termsAcceptedAt,
      },
    });
  } catch (error) {
    logger.error('getSwapAgreement failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/address
 * Share encrypted shipping destination address.
 */
export async function shareSwapAddress(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const rawAddr = req.body || {};
    const address: SwapAddressData = {
      fullName: cleanStr(rawAddr.fullName, 100) as string,
      phone: (cleanStr(rawAddr.phone, 20) ?? '') as string,
      line1: cleanStr(rawAddr.line1, 200) as string,
      line2: cleanStr(rawAddr.line2, 200),
      city: (cleanStr(rawAddr.city, 100) ?? '') as string,
      state: (cleanStr(rawAddr.state, 100) ?? '') as string,
      pincode: cleanStr(typeof rawAddr.pincode === 'number' ? String(rawAddr.pincode) : rawAddr.pincode, 12) as string,
    };

    if (!address.fullName || !address.line1 || !address.pincode) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Complete delivery address is required' });
      return;
    }

    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const isInitiator = swap.initiatorId === req.user.id;
    const isReceiver = swap.receiverId === req.user.id;

    if (!isInitiator && !isReceiver) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Addresses can only be shared on an accepted swap' });
      return;
    }
    const addrMeta = await getSwapMetadata(id);
    if (!(addrMeta.initiatorAcceptedTerms && addrMeta.receiverAcceptedTerms)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Both parties must sign the agreement before sharing addresses' });
      return;
    }

    await updateSwapMetadata(id, (meta) => {
      if (isInitiator) {
        meta.initiatorAddress = address;
      } else {
        meta.receiverAddress = address;
      }
      if (meta.initiatorAddress && meta.receiverAddress) {
        meta.addressSharedAt = new Date().toISOString();
      }
    });

    const fullSwap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    res.json({ data: await formatSwapTransaction(fullSwap, req.user.id) });
  } catch (error) {
    logger.error('shareSwapAddress failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /swaps/:id/shipping-address
 * Retrieve counterpart's shipping address (privacy-guarded).
 */
export async function getShippingAddress(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({ where: { id } });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    if (swap.status !== 'ACCEPTED' && swap.status !== 'COMPLETED') {
      res.json({ data: null, message: 'Addresses are not available for this swap.' });
      return;
    }

    const meta = await getSwapMetadata(id);
    const bothSigned = !!(meta.initiatorAcceptedTerms && meta.receiverAcceptedTerms);

    if (!bothSigned) {
      res.json({
        data: null,
        message: 'Addresses are protected and only revealed once both parties sign the swap agreement.',
      });
      return;
    }

    const isInitiator = swap.initiatorId === req.user.id;
    const counterpartAddress = isInitiator ? meta.receiverAddress : meta.initiatorAddress;

    res.json({ data: counterpartAddress || null });
  } catch (error) {
    logger.error('getShippingAddress failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/ship
 * Submit dispatch & tracking details.
 */
export async function markSwapShipped(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const rawTrack = req.body || {};
    const courierPartner = cleanStr(rawTrack.courierPartner, 100);
    const trackingNumber = cleanStr(
      typeof rawTrack.trackingNumber === 'number' ? String(rawTrack.trackingNumber) : rawTrack.trackingNumber,
      100
    );

    if (!courierPartner || !trackingNumber) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Courier partner and tracking number are required' });
      return;
    }
    const trackingUrlRaw = cleanStr(rawTrack.trackingUrl, 500);
    const tracking: SwapTrackingData = {
      courierPartner,
      trackingNumber,
      trackingUrl: trackingUrlRaw && /^https?:\/\//i.test(trackingUrlRaw) ? trackingUrlRaw : undefined,
      shippedAt: new Date().toISOString(),
    };
    const estDelivery = cleanStr(rawTrack.estimatedDelivery, 40);
    if (estDelivery && !Number.isNaN(Date.parse(estDelivery))) tracking.estimatedDelivery = estDelivery;

    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const isInitiator = swap.initiatorId === req.user.id;
    const isReceiver = swap.receiverId === req.user.id;

    if (!isInitiator && !isReceiver) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap must be accepted before shipping' });
      return;
    }

    // Server-side guard: a refundable security deposit must be in escrow before dispatch.
    const shipMeta = await getSwapMetadata(id);
    if (!shipMeta.depositEscrowId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Security deposit must be paid before shipping' });
      return;
    }

    if (shipMeta.dispute && shipMeta.dispute.status === 'OPEN') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap has an open dispute' });
      return;
    }

    await updateSwapMetadata(id, (meta) => {
      if (isInitiator) {
        meta.initiatorTracking = tracking;
      } else {
        meta.receiverTracking = tracking;
      }
    });

    const fullSwap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    // Notify swap partner that package has been shipped
    const partnerId = isInitiator ? swap.receiverId : swap.initiatorId;
    const shippedItemTitle = isInitiator ? fullSwap?.offeredGarment?.title : fullSwap?.wantedGarment?.title;
    try {
      await createNotification({
        userId: partnerId,
        type: 'SWAP_SHIPPED',
        title: 'Swap Package Shipped! 📦',
        body: `Your swap partner shipped "${shippedItemTitle || 'their accessory'}" via ${tracking.courierPartner} (Tracking #${tracking.trackingNumber}).`,
        data: {
          swapId: id,
          trackingNumber: tracking.trackingNumber,
          courierPartner: tracking.courierPartner,
          targetRoute: `/(tabs)/swap/shipping?swapId=${id}`,
        },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap shipped notification', { error: notifErr });
    }

    res.json({ data: await formatSwapTransaction(fullSwap, req.user.id) });
  } catch (error) {
    logger.error('markSwapShipped failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/confirm-received
 * Confirm condition and receipt. When both confirm, execute atomic ownership swap!
 */
export async function confirmSwapReceived(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({
      where: { id },
      include: {
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const isInitiator = swap.initiatorId === req.user.id;
    const isReceiver = swap.receiverId === req.user.id;

    if (!isInitiator && !isReceiver) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    // Guard: receipt can only be confirmed once the swap is underway (accepted).
    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap is not active for delivery confirmation' });
      return;
    }

    // A party can only confirm receipt once the counterparty has shipped, and not during a dispute.
    const preMeta = await getSwapMetadata(id);
    if (preMeta.dispute && preMeta.dispute.status === 'OPEN') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap has an open dispute' });
      return;
    }
    if (!(isInitiator ? preMeta.receiverTracking : preMeta.initiatorTracking)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Your partner has not shipped yet' });
      return;
    }

    const meta = await updateSwapMetadata(id, (meta) => {
      if (isInitiator) {
        meta.initiatorReceived = true;
      } else {
        meta.receiverReceived = true;
      }
    });

    const bothConfirmed = meta.initiatorReceived && meta.receiverReceived;

    // If both confirmed, execute atomic transfer (status-guarded: runs exactly once)
    if (bothConfirmed) {
      const finalized = await finalizeSwapOnce(id, swap);
      if (!finalized) {
        // Already completed by a concurrent call; just return current state.
        const cur = await db.swap.findUnique({
          where: { id },
          include: {
            initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
            receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
            offeredGarment: true,
            wantedGarment: true,
          },
        });
        res.json({ data: await formatSwapTransaction(cur, req.user.id) });
        return;
      }

      // Socket & in-app notifications
      emitToUser(swap.initiatorId, 'swap:completed', { swapId: id });
      emitToUser(swap.receiverId, 'swap:completed', { swapId: id });

      try {
        await createNotification({
          userId: swap.initiatorId,
          type: 'SWAP_COMPLETED',
          title: '🎉 Swap Completed!',
          body: `Your accessory exchange is complete. Ownership of "${swap.wantedGarment?.title || 'accessory'}" is now yours!`,
          data: { swapId: id, targetRoute: `/(tabs)/swap/details?swapId=${id}&review=1` },
        });
        await createNotification({
          userId: swap.receiverId,
          type: 'SWAP_COMPLETED',
          title: '🎉 Swap Completed!',
          body: `Your accessory exchange is complete. Ownership of "${swap.offeredGarment?.title || 'accessory'}" is now yours!`,
          data: { swapId: id, targetRoute: `/(tabs)/swap/details?swapId=${id}&review=1` },
        });
        // Prompt mutual peer reviews
        await createNotification({
          userId: swap.initiatorId,
          type: 'PEER_REVIEW',
          title: '⭐ Rate Your Swap Experience',
          body: `How was your exchange experience with ${swap.receiver?.displayName || 'your partner'}? Tap to leave a quick rating.`,
          data: { swapId: id, partnerId: swap.receiverId, targetRoute: `/(tabs)/swap/details?swapId=${id}&review=1` },
        });
        await createNotification({
          userId: swap.receiverId,
          type: 'PEER_REVIEW',
          title: '⭐ Rate Your Swap Experience',
          body: `How was your exchange experience with ${swap.initiator?.displayName || 'your partner'}? Tap to leave a quick rating.`,
          data: { swapId: id, partnerId: swap.initiatorId, targetRoute: `/(tabs)/swap/details?swapId=${id}&review=1` },
        });
      } catch (notifErr) {
        logger.warn('Failed to send swap completed notification', { error: notifErr });
      }
    } else {
      const otherUserId = isInitiator ? swap.receiverId : swap.initiatorId;
      emitToUser(otherUserId, 'swap:item_received', { swapId: id, confirmedBy: req.user.id });
      try {
        await createNotification({
          userId: otherUserId,
          type: 'SWAP_RECEIVED',
          title: 'Package Received Confirmation',
          body: 'Your swap partner confirmed receiving their accessory. Please confirm when yours arrives to finalize.',
          data: { swapId: id },
        });
      } catch (notifErr) {
        logger.warn('Failed to send swap received notification', { error: notifErr });
      }
    }

    const fullSwap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    res.json({ data: await formatSwapTransaction(fullSwap, req.user.id) });
  } catch (error) {
    logger.error('confirmSwapReceived failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/complete
 * Directly trigger completion (marks both received and executes ownership swap).
 */
export async function completeSwap(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({
      where: { id },
      include: {
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    // Guard: ownership may only transfer for an accepted swap, and only once.
    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message:
          'Swap must be accepted (with both items shipped and received) before completion can be triggered',
      });
      return;
    }

    const completionMeta = await getSwapMetadata(id);
    const shippedBoth = !!(completionMeta.initiatorTracking && completionMeta.receiverTracking);
    const alreadyCompleted = completionMeta.depositReleasedAt || swap.status === 'COMPLETED';
    if (!shippedBoth || alreadyCompleted) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Both parties must have shipped (and completion must not already be done) to trigger completion',
      });
      return;
    }

    if (completionMeta.dispute && completionMeta.dispute.status === 'OPEN') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap has an open dispute' });
      return;
    }

    const completed = await finalizeSwapOnce(id, swap);
    if (!completed) {
      res.status(409).json({ error: 'CONFLICT', message: 'Swap is already completed or no longer active' });
      return;
    }

    emitToUser(swap.initiatorId, 'swap:completed', { swapId: id });
    emitToUser(swap.receiverId, 'swap:completed', { swapId: id });

    try {
      await createNotification({
        userId: swap.initiatorId,
        type: 'SWAP_COMPLETED',
        title: '🎉 Swap Completed!',
        body: `Your accessory exchange is complete. Ownership of "${swap.wantedGarment?.title || 'accessory'}" is now yours!`,
        data: { swapId: id, targetRoute: `/(tabs)/swap/shipping?swapId=${id}` },
      });
      await createNotification({
        userId: swap.receiverId,
        type: 'SWAP_COMPLETED',
        title: '🎉 Swap Completed!',
        body: `Your accessory exchange is complete. Ownership of "${swap.offeredGarment?.title || 'accessory'}" is now yours!`,
        data: { swapId: id, targetRoute: `/(tabs)/swap/shipping?swapId=${id}` },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap completed notification', { error: notifErr });
    }

    const fullSwap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    res.json({ data: await formatSwapTransaction(fullSwap, req.user.id) });
  } catch (error) {
    logger.error('completeSwap failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/pay-deposit
 * Pay security deposit for swap transaction.
 */
export async function paySecurityDeposit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const userId = req.user.id;
    const { id } = req.params;
    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'SWAP_NOT_FOUND', message: 'Swap request not found' });
      return;
    }
    if (swap.initiatorId !== userId && swap.receiverId !== userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
      return;
    }

    const meta = await getSwapMetadata(id);
    const amountInRupees = meta.securityDepositAmount || 500;

    // Server-side guard: deposits only make sense on an accepted swap.
    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Deposits can only be paid on an accepted swap' });
      return;
    }

    let razorpayOrderId = `order_swap_dep_${id.slice(0, 8)}_${Date.now()}`;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keyId && keySecret) {
      try {
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await rzp.orders.create({
          amount: Math.round(amountInRupees * 100), // convert to paise only for Razorpay API
          currency: 'INR',
          receipt: `swap_dep_${id.slice(0, 10)}`,
          notes: { swapId: id, userId, type: 'SWAP_DEPOSIT' },
        });
        razorpayOrderId = order.id;
      } catch (rzpErr) {
        logger.warn('Failed to create Razorpay order for swap deposit, using fallback id', { error: rzpErr });
      }
    }

    // Only record a pending order here; escrow is credited after signature verification.
    await updateSwapMetadata(id, (m) => {
      const pend = ((m as any).pendingDepositOrders ||= {}) as Record<string, string>;
      pend[userId] = razorpayOrderId;
    });

    res.json({
      data: {
        razorpayOrderId,
        amount: amountInRupees,
      },
    });
  } catch (error) {
    logger.error('paySecurityDeposit failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /swaps/:id/deposit
 * Get deposit status for swap.
 */
export async function getDepositStatus(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'SWAP_NOT_FOUND', message: 'Swap request not found' });
      return;
    }
    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
      return;
    }

    const meta = await getSwapMetadata(id);
    const isInitiator = swap.initiatorId === req.user.id;
    const myDepositPaid = isInitiator ? !!meta.initiatorDepositPaid : !!meta.receiverDepositPaid;
    res.json({
      data: {
        amount: meta.securityDepositAmount || 500,
        paid: myDepositPaid || !!meta.securityDepositPaidBy,
        paidBy: meta.securityDepositPaidBy || null,
        releasedAt: meta.depositReleasedAt || null,
      },
    });
  } catch (error) {
    logger.error('getDepositStatus failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/verify-deposit
 * Verify Razorpay payment signature for swap security deposit.
 */
export async function verifySecurityDeposit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const userId = req.user.id;
    const body = req.body || {};
    const razorpay_order_id = cleanStr(body.razorpay_order_id, 100);
    const razorpay_payment_id = cleanStr(body.razorpay_payment_id, 100);
    const razorpay_signature = cleanStr(body.razorpay_signature, 200);

    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'SWAP_NOT_FOUND', message: 'Swap request not found' });
      return;
    }

    if (swap.initiatorId !== userId && swap.receiverId !== userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
      return;
    }
    if (swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Deposits can only be paid on an accepted swap' });
      return;
    }

    // Signature is mandatory whenever Razorpay credentials are configured.
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret) {
      if (!razorpay_signature || !razorpay_order_id || !razorpay_payment_id) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Payment verification details are required' });
        return;
      }
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(razorpay_signature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid payment signature' });
        return;
      }
    }

    // The order being verified must be one this user created for THIS swap.
    const pendingMeta = await getSwapMetadata(id);
    const pendingOrderId = ((pendingMeta as any).pendingDepositOrders || {})[userId];
    if (razorpay_order_id && pendingOrderId && razorpay_order_id !== pendingOrderId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Payment does not match this swap' });
      return;
    }
    if (secret && !pendingOrderId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'No pending deposit order for this swap' });
      return;
    }
    const alreadyPaid = userId === swap.initiatorId ? pendingMeta.initiatorDepositPaid : pendingMeta.receiverDepositPaid;
    if (alreadyPaid) {
      res.json({
        success: true,
        message: 'Security deposit confirmed and held in escrow',
        data: {
          swapId: id,
          depositPaid: true,
          amount: pendingMeta.securityDepositAmount || 500,
          paidAt: pendingMeta.securityDepositPaidAt,
        },
      });
      return;
    }

    const isInitiator = swap.initiatorId === userId;
    const partnerId = isInitiator ? swap.receiverId : swap.initiatorId;

    // Single transaction: verify signature, flip deposit flags, and lock the
    // metadata row so double-submits cannot double-count.
    const updatedMeta = await updateSwapMetadata(id, (meta) => {
      if (isInitiator) {
        meta.initiatorDepositPaid = true;
        meta.initiatorDepositPaymentId = razorpay_payment_id || 'mock_pay_' + Date.now();
      } else {
        meta.receiverDepositPaid = true;
        meta.receiverDepositPaymentId = razorpay_payment_id || 'mock_pay_' + Date.now();
      }
      meta.securityDepositPaidBy = userId;
      meta.securityDepositPaidAt = new Date().toISOString();
      meta.depositEscrowId = razorpay_order_id || meta.depositEscrowId;
    });

    // Notify other party that escrow deposit is secured
    try {
      await createNotification({
        userId: partnerId,
        type: 'SWAP_ACCEPTED',
        title: '🛡️ Deposit Secured!',
        body: `${(req.user as any)?.displayName || 'Your partner'} has deposited the ₹500 refundable security deposit.`,
        data: { swapId: id },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap deposit notification', { error: notifErr });
    }

    // Emit live socket event
    emitToUser(partnerId, 'swap:deposit_paid', { swapId: id, paidBy: userId });
    emitToUser(userId, 'swap:deposit_paid', { swapId: id, paidBy: userId });

    res.json({
      success: true,
      message: 'Security deposit confirmed and held in escrow',
      data: {
        swapId: id,
        depositPaid: true,
        amount: updatedMeta.securityDepositAmount || 500,
        paidAt: updatedMeta.securityDepositPaidAt,
      },
    });
  } catch (error) {
    logger.error('verifySecurityDeposit failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/dispute
 * Open a dispute for a swap.
 */
export async function openDispute(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const reason = cleanStr(req.body?.reason, 200);
    const description = cleanStr(req.body?.description, 3000);
    const evidencePhotos: unknown = req.body?.evidencePhotos ?? [];

    if (!reason || !description) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'reason and description are required' });
      return;
    }

    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'SWAP_NOT_FOUND', message: 'Swap request not found' });
      return;
    }
    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
      return;
    }

    if (swap.status !== 'ACCEPTED' && swap.status !== 'COMPLETED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'A dispute can only be opened on an active or completed swap' });
      return;
    }

    const otherUserId = swap.initiatorId === req.user.id ? swap.receiverId : swap.initiatorId;

    const dispute = {
      swapId: id,
      openedBy: req.user.id,
      reason,
      description,
      evidencePhotos: (Array.isArray(evidencePhotos) ? evidencePhotos : [])
        .filter((p: any) => typeof p === 'string' && p.length > 0 && p.length <= 40000)
        .slice(0, 6) as string[],
      status: 'OPEN' as const,
    };

    let alreadyOpen = false;
    await updateSwapMetadata(id, (m) => {
      if (m.dispute && m.dispute.status === 'OPEN') {
        alreadyOpen = true;
        return;
      }
      m.dispute = dispute;
      m.disputedAt = new Date().toISOString();
      m.disputeReason = reason;
    });
    if (alreadyOpen) {
      res.status(409).json({ error: 'CONFLICT', message: 'A dispute is already open for this swap' });
      return;
    }

    emitToUser(otherUserId, 'swap:disputed', { swapId: id, reason });

    try {
      await createNotification({
        userId: otherUserId,
        type: 'SWAP_DISPUTED',
        title: '⚠️ Swap Dispute Opened',
        body: `A dispute has been opened for your swap: "${reason}". Support is reviewing the transaction.`,
        data: { swapId: id },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap disputed notification', { error: notifErr });
    }

    res.json({ data: dispute });
  } catch (error) {
    logger.error('openDispute failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /swaps/:id/dispute
 * Get dispute details for a swap.
 */
export async function getDispute(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({ where: { id } });
    if (!swap) {
      res.status(404).json({ error: 'SWAP_NOT_FOUND', message: 'Swap request not found' });
      return;
    }
    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
      return;
    }

    const meta = await getSwapMetadata(id);
    res.json({ data: meta.dispute || null });
  } catch (error) {
    logger.error('getDispute failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/cancel
 * Cancel a swap before both parties have shipped.
 */
export async function cancelSwap(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const swap = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    if (!swap) {
      res.status(404).json({ error: 'SWAP_NOT_FOUND', message: 'Swap request not found' });
      return;
    }
    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this swap' });
      return;
    }
    if (swap.status === 'COMPLETED') {
      res.status(400).json({ error: 'ALREADY_COMPLETED', message: 'Cannot cancel a completed swap' });
      return;
    }
    if (swap.status !== 'REQUESTED' && swap.status !== 'ACCEPTED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap is no longer active' });
      return;
    }

    const meta = await getSwapMetadata(id);
    if (meta.initiatorTracking && meta.receiverTracking) {
      res.status(400).json({ error: 'ALREADY_SHIPPED', message: 'Cannot cancel after both parties have shipped items' });
      return;
    }

    const wasAccepted = swap.status === 'ACCEPTED';
    const cancelled = await (db as any).$transaction(async (tx: any) => {
      const r = await tx.swap.updateMany({
        where: { id, status: swap.status },
        data: { status: 'REJECTED' },
      });
      if (r.count !== 1) return false;
      // Reactivate the reserved garments (only reserved on ACCEPTED) — cancellation must not destroy listings.
      if (wasAccepted) {
        await tx.garment.updateMany({
          where: { id: { in: [swap.garmentOffered, swap.garmentWanted] }, lifecycleState: 'LISTED' },
          data: { isActive: true },
        });
      }
      return true;
    });
    if (!cancelled) {
      res.status(409).json({ error: 'CONFLICT', message: 'Swap state changed, please refresh' });
      return;
    }

    await updateSwapMetadata(id, (m) => {
      m.cancelledAt = new Date().toISOString();
      if (m.securityDepositPaidBy && !m.depositReleasedAt) {
        m.depositReleasedAt = new Date().toISOString();
      }
    });

    const otherUserId = swap.initiatorId === req.user.id ? swap.receiverId : swap.initiatorId;
    emitToUser(otherUserId, 'swap:cancelled', { swapId: id });

    try {
      await createNotification({
        userId: otherUserId,
        type: 'SWAP_CANCELLED',
        title: 'Swap Request Cancelled',
        body: 'The accessory swap request was cancelled.',
        data: { swapId: id },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap cancelled notification', { error: notifErr });
    }

    const updated = await db.swap.findUnique({
      where: { id },
      include: {
        initiator: { select: { id: true, displayName: true, username: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, username: true, avatar: true } },
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    res.json({ data: await formatSwapTransaction(updated, req.user.id) });
  } catch (error) {
    logger.error('cancelSwap failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /swaps/:id/review
 * Submit a peer review for a completed swap.
 */
export async function postSwapReview(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const rating = req.body?.rating;
    const comment = cleanStr(req.body?.comment, 1000);

    const numRating = typeof rating === 'number' || typeof rating === 'string' ? Number(rating) : NaN;
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Rating must be an integer between 1 and 5' });
      return;
    }

    const swap = await db.swap.findUnique({
      where: { id },
      include: {
        offeredGarment: true,
        wantedGarment: true,
      },
    });

    if (!swap) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Swap not found' });
      return;
    }

    if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
      return;
    }

    if (swap.status !== 'COMPLETED') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap must be completed before reviewing' });
      return;
    }

    const isInitiator = swap.initiatorId === req.user.id;
    const otherUserId = isInitiator ? swap.receiverId : swap.initiatorId;
    const receivedGarmentId = isInitiator ? swap.garmentWanted : swap.garmentOffered;

    const newReview = {
      reviewerId: req.user.id,
      reviewerName: req.user.displayName || 'Swap Partner',
      rating: numRating,
      comment,
      createdAt: new Date().toISOString(),
    };

    // Atomic (row-locked) duplicate check + write
    let duplicate = false;
    const savedMeta = await updateSwapMetadata(id, (m) => {
      const r: any = m.reviews || {};
      if (r[req.user!.id]) {
        duplicate = true;
        return;
      }
      r[req.user!.id] = newReview;
      m.reviews = r;
    });
    if (duplicate) {
      res.status(409).json({ error: 'CONFLICT', message: 'You have already submitted a review for this swap' });
      return;
    }
    const reviews = savedMeta.reviews || {};

    // Persist in relational db.review for the received garment
    if (receivedGarmentId) {
      try {
        await db.review.upsert({
          where: {
            userId_garmentId: {
              userId: req.user.id,
              garmentId: receivedGarmentId,
            },
          },
          create: {
            userId: req.user.id,
            garmentId: receivedGarmentId,
            rating: numRating,
            comment: comment ?? null,
          },
          update: {
            rating: numRating,
            comment: comment ?? null,
          },
        });
      } catch (dbErr) {
        logger.warn('Failed to upsert db.review for swap garment', { error: dbErr });
      }
    }

    // Realtime notification & socket emit to partner
    emitToUser(otherUserId, 'swap:reviewed', { swapId: id, review: newReview, reviews });

    try {
      await createNotification({
        userId: otherUserId,
        type: 'PEER_REVIEW',
        title: '⭐️ Swap Review Received!',
        body: `${req.user?.displayName || 'Your swap partner'} left you a ${numRating}-star review for swap #${id.slice(0, 8).toUpperCase()}.`,
        data: { swapId: id, targetRoute: `/(tabs)/swap/shipping?swapId=${id}` },
      });
    } catch (notifErr) {
      logger.warn('Failed to send swap review notification', { error: notifErr });
    }

    res.status(201).json({ success: true, data: newReview, reviews });
  } catch (error) {
    logger.error('postSwapReview failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}


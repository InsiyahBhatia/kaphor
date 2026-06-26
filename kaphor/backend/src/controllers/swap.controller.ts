import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitToUser } from '../lib/socket';
import { getDownloadUrl } from '../lib/s3';

const ALLOWED_SWAP_CATEGORIES = new Set([
  'accessory',
  'accessories',
  'bag',
  'bags',
  'jewelry',
  'jewellery',
  'belt',
  'belts',
  'scarf',
  'scarves',
]);

function normalizeCategory(category: string | null | undefined): string {
  return (category ?? '').trim().toLowerCase();
}

/** Helpers to resolve media URLs */
async function resolveUserMedia(user: any) {
  if (!user || !user.avatar) return user;
  const avatar = await getDownloadUrl(user.avatar);
  return { ...user, avatar };
}

async function resolveGarmentMedia(garment: any) {
  if (!garment || !garment.images) return garment;
  const images = await Promise.all(garment.images.map((img: string) => getDownloadUrl(img)));
  return { ...garment, images };
}

async function resolveSwapMedia(swap: any) {
  if (!swap) return swap;
  const [initiator, receiver, offered, wanted] = await Promise.all([
    resolveUserMedia(swap.initiator),
    resolveUserMedia(swap.receiver),
    resolveGarmentMedia(swap.offeredGarment),
    resolveGarmentMedia(swap.wantedGarment)
  ]);
  return { ...swap, initiator, receiver, offeredGarment: offered, wantedGarment: wanted };
}

async function resolveSwapsMedia(swaps: any[]) {
  return Promise.all(swaps.map(s => resolveSwapMedia(s)));
}

export async function createSwapRequest(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        const { garmentOfferedId, garmentWantedId, message } = req.body;
        const initiatorId = req.user.id;

        if (!garmentOfferedId || !garmentWantedId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Both garments are required' });
            return;
        }

        // Fetch garments
        const offeredGarment = await db.garment.findUnique({ where: { id: String(garmentOfferedId) } });
        const wantedGarment = await db.garment.findUnique({ where: { id: String(garmentWantedId) } });

        if (!offeredGarment || !wantedGarment) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Garment(s) not found' });
            return;
        }

        // Validate Ownership
        if (offeredGarment.sellerId !== initiatorId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own the offered garment' });
            return;
        }
        if (wantedGarment.sellerId === initiatorId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot swap with your own garment' });
            return;
        }

        // Validate Categories
        const offeredCategory = normalizeCategory(offeredGarment.category);
        const wantedCategory = normalizeCategory(wantedGarment.category);
        if (!ALLOWED_SWAP_CATEGORIES.has(offeredCategory) || !ALLOWED_SWAP_CATEGORIES.has(wantedCategory)) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Swaps are only supported for Accessories' });
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

        // Create Swap Request
        const swap = await db.swap.create({
            data: {
                initiatorId,
                receiverId: wantedGarment.sellerId,
                garmentOffered: offeredGarment.id,
                garmentWanted: wantedGarment.id,
                message: message || null,
                status: 'REQUESTED'
            }
        });

        // Notifications
        emitToUser(wantedGarment.sellerId, 'swap:request_received', {
            swapId: swap.id,
            message: 'You have a new swap request!'
        });

        // Placeholder for Email Notification
        logger.info(`Email Note: Send swap request email to ${wantedGarment.sellerId}`);

        res.status(201).json({ data: swap });
    } catch (error) {
        logger.error('Failed to create swap request', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to process swap request' });
    }
}

export async function getSwaps(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const userId = req.user.id;

        const swaps = await db.swap.findMany({
            where: {
                OR: [
                    { initiatorId: userId },
                    { receiverId: userId }
                ]
            },
            include: {
                initiator: { select: { id: true, displayName: true, avatar: true } },
                receiver: { select: { id: true, displayName: true, avatar: true } },
                offeredGarment: true,
                wantedGarment: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        const resolved = await resolveSwapsMedia(swaps);
        res.json({ data: resolved });
    } catch (error) {
        logger.error('Failed to fetch swaps', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function respondToSwap(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const { accept } = req.body;

        const swap = await db.swap.findUnique({ where: { id } });

        if (!swap) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Swap not found' });
            return;
        }

        if (swap.receiverId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to respond to this swap' });
            return;
        }

        if (swap.status !== 'REQUESTED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap is no longer pending' });
            return;
        }

        if (accept) {
            // Setup transaction for logical atomicity
            await (db as any).$transaction(async (tx: any) => {
                await tx.swap.update({
                    where: { id },
                    data: { status: 'ACCEPTED' }
                });

                // De-list items
                await tx.garment.updateMany({
                    where: { id: { in: [swap.garmentOffered, swap.garmentWanted] } },
                    data: {
                        isActive: false,
                        lifecycleState: 'OWNERSHIP'
                    }
                });

                // Update Impacts
                const carbonSaved = 10;
                const waterSaved = 1000;

                await tx.impactRecord.upsert({
                    where: { userId: swap.initiatorId },
                    update: { itemsCirculated: { increment: 1 }, carbonSavedKg: { increment: carbonSaved }, waterSavedL: { increment: waterSaved } },
                    create: { userId: swap.initiatorId, itemsCirculated: 1, carbonSavedKg: carbonSaved, waterSavedL: waterSaved }
                });

                await tx.impactRecord.upsert({
                    where: { userId: swap.receiverId },
                    update: { itemsCirculated: { increment: 1 }, carbonSavedKg: { increment: carbonSaved }, waterSavedL: { increment: waterSaved } },
                    create: { userId: swap.receiverId, itemsCirculated: 1, carbonSavedKg: carbonSaved, waterSavedL: waterSaved }
                });
            });

            emitToUser(swap.initiatorId, 'swap:accepted', { swapId: swap.id });
        } else {
            await db.swap.update({
                where: { id },
                data: { status: 'REJECTED' }
            });
            emitToUser(swap.initiatorId, 'swap:rejected', { swapId: swap.id });
        }

        const updated = await db.swap.findUnique({ where: { id } });
        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to respond to swap', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function completeSwap(req: Request, res: Response): Promise<void> {
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

        if (swap.status !== 'ACCEPTED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Swap is not ready to be completed' });
            return;
        }

        if (swap.initiatorId !== req.user.id && swap.receiverId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to complete this swap' });
            return;
        }

        const updated = await db.swap.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            }
        });

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to complete swap', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

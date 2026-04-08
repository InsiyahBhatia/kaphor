import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { uploadToS3, getDownloadUrl } from '../lib/s3';

// ── HELPERS ──────────────────────────────────────────────────────────────────
async function resolveAvatar(avatar: string | null): Promise<string | null> {
  if (!avatar) return null;
  return getDownloadUrl(avatar);
}

async function resolveUserMedia(user: any) {
  if (!user) return user;
  const avatar = await resolveAvatar(user.avatar);
  return { ...user, avatar };
}

async function resolveGarmentMedia(garment: any) {
  if (!garment || !garment.images) return garment;
  const images = await Promise.all(garment.images.map((img: string) => getDownloadUrl(img)));
  return { ...garment, images };
}

async function resolveGarmentsMedia(garments: any[]) {
  return Promise.all(garments.map(g => resolveGarmentMedia(g)));
}

// ── GET /users/profile/:userId/public (no auth) ───────────────────────────────
export async function getPublicUserSummary(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await db.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatar: true,
        bio: true,
        tier: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }
    const agg = await db.peerReview.aggregate({
      where: { sellerId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const peerReviewCount = agg._count._all;
    const peerReviewAvg = agg._avg.rating;
    const trustedSeller = peerReviewCount >= 3 && (peerReviewAvg ?? 0) >= 4;
    const resolvedUser = await resolveUserMedia(user);
    res.json({
      data: {
        ...resolvedUser,
        peerReviewCount,
        peerReviewAvg,
        trustedSeller,
      },
    });
  } catch (error) {
    logger.error('getPublicUserSummary failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

// ── GET /users/me ─────────────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                avatar: true,
                bio: true,
                location: true,
                role: true,
                tier: true,
                styleAesthetic: true,
                onboardingDone: true,
                createdAt: true,
                impactRecord: true,
                _count: {
                    select: {
                        garments: true,
                        followers: true,
                        following: true,
                        ordersAsBuyer: true
                    }
                }
            }
        });

        if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

        // Sold count comes from seller orders
        const soldCount = await db.order.count({
            where: { sellerId: req.user.id, status: 'CONFIRMED' }
        });

        const resolvedUser = await resolveUserMedia(user);
        res.json({
            data: {
                ...resolvedUser,
                stats: {
                    listings: user._count.garments,
                    sold: soldCount,
                    following: user._count.following,
                    followers: user._count.followers,
                    purchases: user._count.ordersAsBuyer
                }
            }
        });
    } catch (error) {
        logger.error('getMe failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── PUT /users/me ─────────────────────────────────────────────────────────────
export async function updateMe(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { displayName, bio, location, styleAesthetic } = req.body;

        const validAesthetics = ['MINIMALIST', 'VINTAGE', 'BOLD', 'ETHNIC', 'STREETWEAR', 'LUXURY'];

        const updated = await db.user.update({
            where: { id: req.user.id },
            data: {
                ...(displayName && { displayName }),
                ...(bio !== undefined && { bio }),
                ...(location !== undefined && { location }),
                ...(styleAesthetic && validAesthetics.includes(styleAesthetic) && { styleAesthetic })
            },
            select: {
                id: true, email: true, username: true,
                displayName: true, avatar: true, bio: true,
                location: true, styleAesthetic: true, tier: true
            }
        });

        const resolvedUser = await resolveUserMedia(updated);
        res.json({ data: resolvedUser });
    } catch (error) {
        logger.error('updateMe failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── PUT /users/me/avatar ──────────────────────────────────────────────────────
export async function updateAvatar(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        let avatarUrl = req.body.avatarUrl;

        // Handle multipart upload from frontend
        if (req.file) {
            const uploaded = await uploadToS3(req.file.buffer, 'avatars', req.file.mimetype);
            avatarUrl = uploaded.url;
        }

        if (!avatarUrl) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'avatarUrl or avatar file is required' });
            return;
        }

        const updated = await db.user.update({
            where: { id: req.user.id },
            data: { avatar: avatarUrl },
            select: { id: true, avatar: true }
        });

        const resolvedUser = await resolveUserMedia(updated);
        res.json({ data: resolvedUser });
    } catch (error) {
        logger.error('updateAvatar failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── GET /users/me/listings ────────────────────────────────────────────────────
export async function getMyListings(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const garments = await db.garment.findMany({
            where: { sellerId: req.user.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, title: true, brand: true, images: true,
                price: true, condition: true, lifecycleState: true,
                isActive: true, createdAt: true
            }
        });

        const resolvedGarments = await resolveGarmentsMedia(garments);
        res.json({ data: resolvedGarments });
    } catch (error) {
        logger.error('getMyListings failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── GET /users/me/purchases ───────────────────────────────────────────────────
export async function getMyPurchases(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const orders = await db.order.findMany({
            where: { buyerId: req.user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        garment: {
                            select: { id: true, title: true, brand: true, images: true }
                        }
                    }
                }
            }
        });

        const resolvedOrders = await Promise.all(orders.map(async (o: any) => ({
            ...o,
            items: await Promise.all(o.items.map(async (i: any) => ({
                ...i,
                garment: await resolveGarmentMedia(i.garment)
            })))
        })));
        res.json({ data: resolvedOrders });
    } catch (error) {
        logger.error('getMyPurchases failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── GET /users/profile/:userId/reviews (public) ──────────────────────────────
export async function getUserReviews(req: Request, res: Response): Promise<void> {
    try {
        const { userId } = req.params;
        const reviews = await db.peerReview.findMany({
            where: { sellerId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                reviewer: {
                    select: { id: true, displayName: true, avatar: true, username: true }
                }
            }
        });

        const resolvedReviews = await Promise.all(reviews.map(async (r: any) => ({
            ...r,
            reviewer: await resolveUserMedia(r.reviewer)
        })));
        res.json({ data: resolvedReviews });
    } catch (error) {
        logger.error('getUserReviews failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

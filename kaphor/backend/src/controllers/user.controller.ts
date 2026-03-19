import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { uploadImage } from '../lib/cloudinary';

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

        res.json({
            data: {
                ...user,
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

        res.json({ data: updated });
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
            const uploaded = await uploadImage(req.file.buffer, 'avatars');
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

        res.json({ data: updated });
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

        res.json({ data: garments });
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

        res.json({ data: orders });
    } catch (error) {
        logger.error('getMyPurchases failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

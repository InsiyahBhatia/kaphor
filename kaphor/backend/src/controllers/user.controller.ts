import { Request, Response } from 'express';
import db from '../lib/prisma';
import { redisDel } from '../lib/redis';
import { logger } from '../lib/logger';
import { uploadToCloudinary, getDownloadUrl } from '../lib/cloudinary';
import { InsightService } from '../services/insight.service';
import { sendPushNotificationToUser } from '../services/pushNotification.service';

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
    const cleanParam = (userId || '').trim();
    const user = await db.user.findFirst({
      where: {
        OR: [
          { id: cleanParam },
          { username: cleanParam.replace(/^@/, '') },
        ],
        isActive: true,
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatar: true,
        bio: true,
        tier: true,
        isVerified: true,
        verificationStatus: true,
        verificationType: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }
    const [peerReviews, garmentReviews] = await Promise.all([
      db.peerReview.findMany({
        where: { sellerId: user.id },
        select: { rating: true },
      }),
      db.review.findMany({
        where: { garment: { sellerId: user.id } },
        select: { rating: true },
      }),
    ]);
    const allReviews = [...peerReviews, ...garmentReviews];
    const peerReviewCount = allReviews.length;
    const peerReviewAvg =
      peerReviewCount > 0
        ? allReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / peerReviewCount
        : null;
    const ratingBreakdown = {
      5: allReviews.filter((r: { rating: number }) => r.rating === 5).length,
      4: allReviews.filter((r: { rating: number }) => r.rating === 4).length,
      3: allReviews.filter((r: { rating: number }) => r.rating === 3).length,
      2: allReviews.filter((r: { rating: number }) => r.rating === 2).length,
      1: allReviews.filter((r: { rating: number }) => r.rating === 1).length,
    };
    const trustedSeller = (peerReviewCount >= 3 && (peerReviewAvg ?? 0) >= 4) || user.isVerified;
    const resolvedUser = await resolveUserMedia(user);

    const listings = await db.garment.findMany({
      where: {
        sellerId: user.id,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const resolvedListings = await resolveGarmentsMedia(listings);

    res.json({
      data: {
        ...resolvedUser,
        listings: resolvedListings,
        peerReviewCount,
        peerReviewAvg,
        ratingBreakdown,
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
        const stats = {
            listings: user._count.garments,
            sold: soldCount,
            following: user._count.following,
            followers: user._count.followers,
            purchases: user._count.ordersAsBuyer
        };
        console.log(`[USER_DEBUG] Stats for ${user.email}:`, stats);
        res.json({
            data: {
                ...resolvedUser,
                stats
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

        const { displayName, bio, location, styleAesthetic, username } = req.body;

        let cleanUsername: string | undefined = undefined;
        if (username !== undefined) {
            cleanUsername = String(username).trim().toLowerCase().replace(/^@/, '');
            if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
                res.status(400).json({ 
                    error: 'INVALID_USERNAME', 
                    message: 'Username must be 3-30 characters and contain only lowercase letters, numbers, and underscores.' 
                });
                return;
            }
            // Check if username taken by another user
            const existing = await db.user.findFirst({
                where: {
                    username: cleanUsername,
                    NOT: { id: req.user.id }
                }
            });
            if (existing) {
                res.status(400).json({ 
                    error: 'USERNAME_TAKEN', 
                    message: 'This username is already taken. Please choose another.' 
                });
                return;
            }
        }

        const all16Aesthetics = [
            'Y2K', 'Office Siren', 'Rockstar Girlfriend', 'Sade Girl', 'Vintage',
            'Acubi', 'Business Comfort', 'Cottagecore', 'Dark Academia', 'Dark Coquette',
            'Fleur Noire', 'Grunge', 'Mermaid Core', 'Minimal Desi', 'Maximal Desi', 'Soft Girl'
        ];

        let finalAesthetic: string | undefined = undefined;
        if (styleAesthetic) {
            const matched16 = all16Aesthetics.find(a => a.toLowerCase() === String(styleAesthetic).trim().toLowerCase());
            finalAesthetic = matched16 || styleAesthetic;
        }

        const updated = await db.user.update({
            where: { id: req.user.id },
            data: {
                ...(cleanUsername && { username: cleanUsername }),
                ...(displayName && { displayName }),
                ...(bio !== undefined && { bio }),
                ...(location !== undefined && { location }),
                ...(finalAesthetic && { styleAesthetic: finalAesthetic })
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
            const uploaded = await uploadToCloudinary(req.file.buffer, 'avatars', req.file.mimetype);
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
            where: { 
                sellerId: req.user.id,
                isActive: true,
                lifecycleState: { in: ['LISTED', 'INTEREST'] }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, title: true, brand: true, images: true,
                price: true, rentalPriceDay: true, rentalPriceWeek: true,
                listingType: true, condition: true, lifecycleState: true,
                isActive: true, viewCount: true, createdAt: true
            }
        });

        const garmentIds = garments.map((g: any) => g.id);
        const insightsMap = await InsightService.getBatchListingsSummary(garmentIds);
        const resolvedGarments = await resolveGarmentsMedia(garments);

        const garmentsWithInsights = resolvedGarments.map((g: any) => ({
            ...g,
            insights: insightsMap[g.id] || { views: g.viewCount || 0, inCart: 0, saves: 0, inquiries: 0 },
        }));

        res.json({ data: garmentsWithInsights });
    } catch (error) {
        logger.error('getMyListings failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── GET /users/me/wardrobe ────────────────────────────────────────────────────
export async function getMyWardrobe(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const uid = req.user.id;

        // 1. Directly owned garments
        const ownedGarments = await db.garment.findMany({
            where: { 
                sellerId: uid,
                lifecycleState: { in: ['OWNERSHIP', 'INTEREST', 'LISTED', 'DECLINE', 'CIRCULATION', 'REUSE_UPCYCLE_RECYCLE', 'SELL_INTENT', 'PURCHASE_INTENT'] }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, title: true, brand: true, images: true,
                price: true, rentalPriceDay: true, rentalPriceWeek: true,
                listingType: true, condition: true, lifecycleState: true,
                isActive: true, createdAt: true
            }
        });

        // 2. Garments from confirmed, shipped, or delivered buyer orders
        const buyerOrders = await db.order.findMany({
            where: {
                buyerId: uid,
                status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }
            },
            include: {
                items: {
                    include: {
                        garment: {
                            select: {
                                id: true, title: true, brand: true, images: true,
                                price: true, rentalPriceDay: true, rentalPriceWeek: true,
                                listingType: true, condition: true, lifecycleState: true,
                                isActive: true, createdAt: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // 3. Garments currently on active rental lease to this user
        const activeRentals = await db.rental.findMany({
            where: {
                renterId: uid,
                status: { in: ['RESERVED', 'ACTIVE'] }
            },
            include: {
                garment: {
                    select: {
                        id: true, title: true, brand: true, images: true,
                        price: true, rentalPriceDay: true, rentalPriceWeek: true,
                        listingType: true, condition: true, lifecycleState: true,
                        isActive: true, createdAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const seenGarmentIds = new Set(ownedGarments.map((g: any) => g.id));
        const combined = [...ownedGarments];

        for (const order of buyerOrders) {
            for (const item of (order.items || [])) {
                if (item.garment && !seenGarmentIds.has(item.garment.id)) {
                    seenGarmentIds.add(item.garment.id);
                    combined.push({
                        ...item.garment,
                        lifecycleState: 'OWNERSHIP',
                    });
                }
            }
        }

        for (const rental of activeRentals) {
            if (rental.garment && !seenGarmentIds.has(rental.garment.id)) {
                seenGarmentIds.add(rental.garment.id);
                combined.push({
                    ...rental.garment,
                    lifecycleState: 'RENTED',
                    isRented: true,
                    rentalId: rental.id,
                    rentalStatus: rental.status,
                    startDate: rental.startDate,
                    endDate: rental.endDate,
                });
            }
        }

        const resolvedGarments = await resolveGarmentsMedia(combined);
        res.json({ data: resolvedGarments });
    } catch (error) {
        logger.error('getMyWardrobe failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── POST /users/me/wardrobe/items ─────────────────────────────────────────────
export async function addWardrobeItems(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'items array is required' });
            return;
        }

        const validConditions = ['PRISTINE', 'MINOR_WEAR', 'UPCYCLE', 'RECYCLE_ONLY'];
        const createdGarments = [];

        for (const item of items) {
            const condition = validConditions.includes(item.condition) ? item.condition : 'PRISTINE';
            const price = item.price != null ? Math.round(Number(item.price)) : (item.estimatedPrice != null ? Math.round(Number(item.estimatedPrice)) : null);
            const rentalDay = item.rentalPriceDay != null ? Math.round(Number(item.rentalPriceDay)) : (item.suggestedRentalPriceDay != null ? Math.round(Number(item.suggestedRentalPriceDay)) : null);
            const rentalWeek = item.rentalPriceWeek != null ? Math.round(Number(item.rentalPriceWeek)) : (item.suggestedRentalPriceWeek != null ? Math.round(Number(item.suggestedRentalPriceWeek)) : null);

            const garment = await db.garment.create({
                data: {
                    sellerId: req.user.id,
                    title: item.title || 'Digital Wardrobe Piece',
                    description: item.description || 'Digitized into digital closet via Google Wardrobe AI.',
                    brand: item.brand || 'Contemporary',
                    category: item.category || 'Tops',
                    subCategory: item.subCategory || null,
                    size: item.size || 'M',
                    color: Array.isArray(item.color) ? item.color : [item.color || 'Neutral'],
                    material: Array.isArray(item.material) ? item.material : [item.material || 'Cotton'],
                    condition,
                    images: Array.isArray(item.images) ? item.images : [item.imageUrl || item.image].filter(Boolean),
                    tags: ['digital-wardrobe', 'digitized'],
                    styleTags: [item.category || 'wardrobe'],
                    garmentVector: Array.from({ length: 16 }, () => Number((Math.random() * 0.4 - 0.2).toFixed(4))),
                    lifecycleState: 'OWNERSHIP',
                    listingType: item.listingType || 'SALE',
                    price,
                    rentalPriceDay: rentalDay,
                    rentalPriceWeek: rentalWeek,
                    isActive: false, // Private in user's digital wardrobe until listed
                },
            });

            // Log wear/circular ownership event
            await db.behaviourEvent.create({
                data: {
                    userId: req.user.id,
                    garmentId: garment.id,
                    eventType: 'LOG_WEAR',
                },
            }).catch(() => {});

            createdGarments.push(garment);
        }

        await redisDel(`user:${req.user.id}:wardrobe`).catch(() => {});

        res.json({
            success: true,
            count: createdGarments.length,
            data: createdGarments,
        });
    } catch (error: any) {
        logger.error('addWardrobeItems failed', { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
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
        const [peerReviews, garmentReviews] = await Promise.all([
            db.peerReview.findMany({
                where: { sellerId: userId, reviewerId: { not: userId } },
                orderBy: { createdAt: 'desc' },
                include: {
                    reviewer: {
                        select: { id: true, displayName: true, avatar: true, username: true, isVerified: true }
                    },
                    order: {
                        select: {
                            id: true,
                            createdAt: true,
                            items: {
                                take: 1,
                                include: {
                                    garment: {
                                        select: { id: true, title: true, brand: true, images: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            db.review.findMany({
                where: { garment: { sellerId: userId }, userId: { not: userId } },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { id: true, displayName: true, avatar: true, username: true, isVerified: true }
                    },
                    garment: {
                        select: { id: true, title: true, brand: true, images: true }
                    }
                }
            })
        ]);

        const resolvedPeerReviews = await Promise.all(peerReviews.map(async (r: any) => {
            const reviewer = await resolveUserMedia(r.reviewer);
            let garment = null;
            if (r.order?.items?.[0]?.garment) {
                garment = await resolveGarmentMedia(r.order.items[0].garment);
            }
            return {
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.createdAt,
                reviewer,
                garment,
                source: 'ORDER',
            };
        }));

        const resolvedGarmentReviews = await Promise.all(garmentReviews.map(async (r: any) => {
            const reviewer = await resolveUserMedia(r.user);
            let garment = null;
            if (r.garment) {
                garment = await resolveGarmentMedia(r.garment);
            }
            return {
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.createdAt,
                reviewer,
                garment,
                source: 'TRANSACTION',
            };
        }));

        const allCombined = [...resolvedPeerReviews, ...resolvedGarmentReviews]
            .filter((r) => r.reviewer && r.reviewer.id !== userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json({ data: allCombined });
    } catch (error) {
        logger.error('getUserReviews failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── POST /users/me/verify-identity ──────────────────────────────────────────
export async function submitIdentityVerification(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const { verificationType, idNumber, documentUrl } = req.body;
        if (!verificationType || !idNumber) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'verificationType and idNumber are required' });
            return;
        }

        const idNumberLast4 = String(idNumber).trim().slice(-4);
        const updated = await db.user.update({
            where: { id: req.user.id },
            data: {
                isVerified: true,
                verificationStatus: 'VERIFIED',
                verificationType,
                idNumberLast4,
                verificationDocUrl: documentUrl || null,
                verificationSubmittedAt: new Date(),
            },
            select: {
                id: true,
                isVerified: true,
                verificationStatus: true,
                verificationType: true,
                idNumberLast4: true,
                verificationSubmittedAt: true,
            },
        });

        res.json({
            data: updated,
            message: 'Identity successfully verified! Your verified luxury trust badge is now active.',
        });
    } catch (error) {
        logger.error('submitIdentityVerification failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── GET /users/me/verification-status ───────────────────────────────────────
export async function getVerificationStatus(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: {
                isVerified: true,
                verificationStatus: true,
                verificationType: true,
                idNumberLast4: true,
                verificationSubmittedAt: true,
            },
        });
        res.json({ data: user });
    } catch (error) {
        logger.error('getVerificationStatus failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── POST /users/me/push-token ───────────────────────────────────────────────
export async function savePushToken(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const { pushToken } = req.body;
        if (!pushToken || typeof pushToken !== 'string') {
            res.status(400).json({ error: 'INVALID_TOKEN', message: 'Valid pushToken string is required' });
            return;
        }

        await db.user.update({
            where: { id: req.user.id },
            data: { pushToken: pushToken.trim() },
        });

        logger.info('User registered push token', { userId: req.user.id });
        res.json({ success: true, message: 'Push token registered successfully' });
    } catch (error) {
        logger.error('savePushToken failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── POST /users/me/test-push ────────────────────────────────────────────────
export async function sendTestPushNotification(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: { pushToken: true, displayName: true },
        });

        if (!user?.pushToken) {
            res.status(400).json({
                error: 'NO_PUSH_TOKEN',
                message: 'No push token registered for your account. Please open the Kaphor mobile app to register your device.',
            });
            return;
        }

        const success = await sendPushNotificationToUser(
            req.user.id,
            'Kaphor Alert',
            'Phone out-of-app notification is active and working properly!',
            { type: 'TEST_ALERT', url: '/(tabs)/messages' },
            'default'
        );

        res.json({
            success,
            message: success
                ? 'Test notification dispatched to your phone!'
                : 'Failed to dispatch test notification. Check server logs.',
            pushTokenSnippet: user.pushToken.slice(0, 20) + '...',
        });
    } catch (error) {
        logger.error('sendTestPushNotification failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}


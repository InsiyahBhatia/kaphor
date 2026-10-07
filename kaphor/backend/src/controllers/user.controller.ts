import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { Request, Response } from 'express';
import db from '../lib/prisma';
import { redisDel } from '../lib/redis';
import { logger } from '../lib/logger';
import { uploadToCloudinary, getDownloadUrl } from '../lib/cloudinary';
import { InsightService } from '../services/insight.service';
import { sendPushWithDiagnostics } from '../services/pushNotification.service';

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

// ── Style Aesthetic Enum Mapping ──────────────────────────────────────────────
export type StyleAestheticKey =
    | 'MINIMALIST' | 'VINTAGE' | 'BOLD' | 'ETHNIC' | 'STREETWEAR' | 'LUXURY'
    | 'Y2K' | 'ACUBI' | 'BUSINESS_COMFORT' | 'COTTAGECORE' | 'DARK_ACADEMIA'
    | 'DARK_COQUETTE' | 'FLEUR_NOIRE' | 'GRUNGE' | 'MERMAID_CORE' | 'OFFICE_SIREN'
    | 'ROCKSTAR_GIRLFRIEND' | 'SADE_GIRL' | 'MINIMAL_DESI' | 'MAXIMAL_DESI' | 'SOFT_GIRL';

const VALID_PRISMA_AESTHETICS = new Set<string>([
    'MINIMALIST', 'VINTAGE', 'BOLD', 'ETHNIC', 'STREETWEAR', 'LUXURY',
    'Y2K', 'ACUBI', 'BUSINESS_COMFORT', 'COTTAGECORE', 'DARK_ACADEMIA',
    'DARK_COQUETTE', 'FLEUR_NOIRE', 'GRUNGE', 'MERMAID_CORE', 'OFFICE_SIREN',
    'ROCKSTAR_GIRLFRIEND', 'SADE_GIRL', 'MINIMAL_DESI', 'MAXIMAL_DESI', 'SOFT_GIRL'
]);

const AESTHETIC_NAME_TO_ENUM: Record<string, StyleAestheticKey> = {
    'Y2K': 'Y2K',
    'ACUBI': 'ACUBI',
    'BUSINESS COMFORT': 'BUSINESS_COMFORT',
    'BUSINESS_COMFORT': 'BUSINESS_COMFORT',
    'BUSINESS-COMFORT': 'BUSINESS_COMFORT',
    'COTTAGECORE': 'COTTAGECORE',
    'DARK ACADEMIA': 'DARK_ACADEMIA',
    'DARK_ACADEMIA': 'DARK_ACADEMIA',
    'DARK-ACADEMIA': 'DARK_ACADEMIA',
    'DARK COQUETTE': 'DARK_COQUETTE',
    'DARK_COQUETTE': 'DARK_COQUETTE',
    'DARK-COQUETTE': 'DARK_COQUETTE',
    'FLEUR NOIRE': 'FLEUR_NOIRE',
    'FLEUR_NOIRE': 'FLEUR_NOIRE',
    'FLEUR-NOIRE': 'FLEUR_NOIRE',
    'GRUNGE': 'GRUNGE',
    'MERMAID CORE': 'MERMAID_CORE',
    'MERMAID_CORE': 'MERMAID_CORE',
    'MERMAID-CORE': 'MERMAID_CORE',
    'OFFICE SIREN': 'OFFICE_SIREN',
    'OFFICE_SIREN': 'OFFICE_SIREN',
    'OFFICE-SIREN': 'OFFICE_SIREN',
    'ROCKSTAR GIRLFRIEND': 'ROCKSTAR_GIRLFRIEND',
    'ROCKSTAR_GIRLFRIEND': 'ROCKSTAR_GIRLFRIEND',
    'ROCKSTAR-GIRLFRIEND': 'ROCKSTAR_GIRLFRIEND',
    'SADE GIRL': 'SADE_GIRL',
    'SADE_GIRL': 'SADE_GIRL',
    'SADE-GIRL': 'SADE_GIRL',
    'VINTAGE': 'VINTAGE',
    'MINIMAL DESI': 'MINIMAL_DESI',
    'MINIMAL_DESI': 'MINIMAL_DESI',
    'MINIMAL-DESI': 'MINIMAL_DESI',
    'MAXIMAL DESI': 'MAXIMAL_DESI',
    'MAXIMAL_DESI': 'MAXIMAL_DESI',
    'MAXIMAL-DESI': 'MAXIMAL_DESI',
    'SOFT GIRL': 'SOFT_GIRL',
    'SOFT_GIRL': 'SOFT_GIRL',
    'SOFT-GIRL': 'SOFT_GIRL',
    'MINIMALIST': 'MINIMALIST',
    'MINIMAL': 'MINIMALIST',
    'BOLD': 'BOLD',
    'ETHNIC': 'ETHNIC',
    'STREETWEAR': 'STREETWEAR',
    'LUXURY': 'LUXURY',
};

const ENUM_TO_DISPLAY_AESTHETIC: Record<string, string> = {
    Y2K: 'Y2K',
    ACUBI: 'Acubi',
    BUSINESS_COMFORT: 'Business Comfort',
    COTTAGECORE: 'Cottagecore',
    DARK_ACADEMIA: 'Dark Academia',
    DARK_COQUETTE: 'Dark Coquette',
    FLEUR_NOIRE: 'Fleur Noire',
    GRUNGE: 'Grunge',
    MERMAID_CORE: 'Mermaid Core',
    OFFICE_SIREN: 'Office Siren',
    ROCKSTAR_GIRLFRIEND: 'Rockstar Girlfriend',
    SADE_GIRL: 'Sade Girl',
    VINTAGE: 'Vintage',
    MINIMAL_DESI: 'Minimal Desi',
    MAXIMAL_DESI: 'Maximal Desi',
    SOFT_GIRL: 'Soft Girl',
    MINIMALIST: 'Minimalist',
    BOLD: 'Bold',
    ETHNIC: 'Ethnic',
    STREETWEAR: 'Streetwear',
    LUXURY: 'Luxury',
};

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
        // Count ratings in the database (GROUP BY) instead of downloading every review row.
        const [peerRatingGroups, garmentRatingGroups] = await Promise.all([
            db.peerReview.groupBy({
                by: ['rating'],
                where: { sellerId: user.id },
                _count: { _all: true },
            }),
            db.review.groupBy({
                by: ['rating'],
                where: { garment: { sellerId: user.id } },
                _count: { _all: true },
            }),
        ]);
        const ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let peerReviewCount = 0;
        let ratingSum = 0;
        for (const g of [...peerRatingGroups, ...garmentRatingGroups] as Array<{ rating: number; _count: { _all: number } }>) {
            const n = g._count._all;
            peerReviewCount += n;
            ratingSum += g.rating * n;
            if (g.rating >= 1 && g.rating <= 5) ratingBreakdown[g.rating as 1 | 2 | 3 | 4 | 5] += n;
        }
        const peerReviewAvg = peerReviewCount > 0 ? ratingSum / peerReviewCount : null;
        const trustedSeller = (peerReviewCount >= 3 && (peerReviewAvg ?? 0) >= 4) || user.isVerified;
        const resolvedUser = await resolveUserMedia(user);

        const listings = await db.garment.findMany({
            where: {
                sellerId: user.id,
                isActive: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: GARMENT_LIST_COLUMNS,
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
                preferenceProfile: true,
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
        const displayAesthetic = (user.preferenceProfile as any)?.selectedAesthetic || (user.styleAesthetic ? ENUM_TO_DISPLAY_AESTHETIC[user.styleAesthetic] || user.styleAesthetic : undefined);
        console.log(`[USER_DEBUG] Stats for ${user.email}:`, stats);
        res.json({
            data: {
                ...resolvedUser,
                styleAesthetic: displayAesthetic,
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

        const body = req.body || {};
        const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
        const displayName = str(body.displayName, 60);
        const bio = str(body.bio, 500);
        const location = str(body.location, 100);
        const styleAesthetic = str(body.styleAesthetic, 60);
        const username = body.username;

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

        let prismaEnumAesthetic: StyleAestheticKey | undefined = undefined;
        let displayAestheticName: string | undefined = undefined;

        if (styleAesthetic) {
            const raw = String(styleAesthetic).trim().toUpperCase();
            if (VALID_PRISMA_AESTHETICS.has(raw)) {
                prismaEnumAesthetic = raw as StyleAestheticKey;
            } else if (AESTHETIC_NAME_TO_ENUM[raw]) {
                prismaEnumAesthetic = AESTHETIC_NAME_TO_ENUM[raw];
            } else {
                const withUnderscore = raw.replace(/[-\s]+/g, '_');
                if (VALID_PRISMA_AESTHETICS.has(withUnderscore)) {
                    prismaEnumAesthetic = withUnderscore as StyleAestheticKey;
                } else if (AESTHETIC_NAME_TO_ENUM[withUnderscore]) {
                    prismaEnumAesthetic = AESTHETIC_NAME_TO_ENUM[withUnderscore];
                } else {
                    prismaEnumAesthetic = 'LUXURY';
                }
            }
            displayAestheticName = ENUM_TO_DISPLAY_AESTHETIC[prismaEnumAesthetic] || prismaEnumAesthetic;
        }

        let preferenceProfileUpdate: any = undefined;
        if (prismaEnumAesthetic) {
            const cur = await db.user.findUnique({
                where: { id: req.user.id },
                select: { preferenceProfile: true }
            });
            const curPref = (cur?.preferenceProfile as any) || {};
            preferenceProfileUpdate = {
                ...curPref,
                selectedAesthetic: displayAestheticName,
                dominantAesthetic: prismaEnumAesthetic,
            };
        }

        const updated = await db.user.update({
            where: { id: req.user.id },
            data: {
                ...(cleanUsername && { username: cleanUsername }),
                ...(displayName && { displayName }),
                ...(bio !== undefined && { bio }),
                ...(location !== undefined && { location }),
                ...(prismaEnumAesthetic && { styleAesthetic: prismaEnumAesthetic }),
                ...(preferenceProfileUpdate && { preferenceProfile: preferenceProfileUpdate }),
            },
            select: {
                id: true, email: true, username: true,
                displayName: true, avatar: true, bio: true,
                location: true, styleAesthetic: true, preferenceProfile: true, tier: true
            }
        });

        const resolvedUser = await resolveUserMedia(updated);
        const finalDisplayAesthetic = (updated.preferenceProfile as any)?.selectedAesthetic || ENUM_TO_DISPLAY_AESTHETIC[updated.styleAesthetic as string] || updated.styleAesthetic;
        res.json({
            data: {
                ...resolvedUser,
                styleAesthetic: finalDisplayAesthetic,
            }
        });
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
            },
            take: 200,
        });

        const garmentIds = garments.map((g: any) => g.id);
        const insightsMap = await InsightService.getBatchListingsSummary(garmentIds);
        const resolvedGarments = await resolveGarmentsMedia(garments);

        const garmentsWithInsights = resolvedGarments.map((g: any) => ({
            ...g,
            insights: insightsMap[g.id] || { views: g.viewCount || 0, saves: 0, inquiries: 0 },
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
            },
            take: 300,
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

        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'items array is required' });
            return;
        }

        const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
        const validConditions = ['PRISTINE', 'MINOR_WEAR', 'UPCYCLE', 'RECYCLE_ONLY'];
        // Build every create up front and run them in ONE transaction (was 2 sequential queries per item).
        const ownerId = req.user!.id;
        const createOps = items.map((item: any) => {
            const condition = validConditions.includes(item.condition) ? item.condition : 'PRISTINE';
            const price = item.price != null ? Math.round(Number(item.price)) : (item.estimatedPrice != null ? Math.round(Number(item.estimatedPrice)) : null);
            const rentalDay = item.rentalPriceDay != null ? Math.round(Number(item.rentalPriceDay)) : (item.suggestedRentalPriceDay != null ? Math.round(Number(item.suggestedRentalPriceDay)) : null);
            const rentalWeek = item.rentalPriceWeek != null ? Math.round(Number(item.rentalPriceWeek)) : (item.suggestedRentalPriceWeek != null ? Math.round(Number(item.suggestedRentalPriceWeek)) : null);

            return db.garment.create({
                data: {
                    sellerId: ownerId,
                    title: txt(item.title, 120) || 'Digital Wardrobe Piece',
                    description: txt(item.description, 2000) || 'Digitized into digital closet via Google Wardrobe AI.',
                    brand: txt(item.brand, 80) || 'Contemporary',
                    category: txt(item.category, 60) || 'Tops',
                    subCategory: txt(item.subCategory, 60) || null,
                    size: txt(item.size, 20) || 'M',
                    color: Array.isArray(item.color) ? item.color.slice(0, 10).map((c: unknown) => txt(c, 40)).filter(Boolean) : [txt(item.color, 40) || 'Neutral'],
                    material: Array.isArray(item.material) ? item.material.slice(0, 10).map((c: unknown) => txt(c, 40)).filter(Boolean) : [txt(item.material, 40) || 'Cotton'],
                    condition,
                    images: (Array.isArray(item.images) ? item.images : [item.imageUrl || item.image]).slice(0, 8).map((u: unknown) => txt(u, 2048)).filter(Boolean),
                    tags: ['digital-wardrobe', 'digitized'],
                    styleTags: [txt(item.category, 60) || 'wardrobe'],
                    garmentVector: Array.from({ length: 16 }, () => Number((Math.random() * 0.4 - 0.2).toFixed(4))),
                    lifecycleState: 'OWNERSHIP',
                    listingType: ['SALE', 'RENTAL', 'ACCESSORY_SWAP'].includes(item.listingType) ? item.listingType : 'SALE',
                    price,
                    rentalPriceDay: rentalDay,
                    rentalPriceWeek: rentalWeek,
                    isActive: false, // Private in user's digital wardrobe until listed
                },
            });
        });

        const createdGarments: any[] = await db.$transaction(createOps);

        // Log wear/circular ownership events for all items in a single insert
        await db.behaviourEvent.createMany({
            data: createdGarments.map((g: any) => ({
                userId: req.user!.id,
                garmentId: g.id,
                eventType: 'LOG_WEAR',
            })),
        }).catch(() => { });

        await redisDel(`user:${req.user.id}:wardrobe`).catch(() => { });

        res.json({
            success: true,
            count: createdGarments.length,
            data: createdGarments,
        });
    } catch (error: any) {
        logger.error('addWardrobeItems failed', { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to add wardrobe items' });
    }
}

// ── GET /users/me/purchases ───────────────────────────────────────────────────
export async function getMyPurchases(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const orders = await db.order.findMany({
            where: { buyerId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 100,
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
                take: 100,
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
                take: 100,
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
        const { verificationType, idNumber, documentUrl } = req.body || {};
        if (
            typeof verificationType !== 'string' || verificationType.length > 40 ||
            typeof idNumber !== 'string' || idNumber.trim().length < 4 || idNumber.length > 40 ||
            (documentUrl != null && (typeof documentUrl !== 'string' || documentUrl.length > 2048))
        ) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'verificationType and idNumber are required' });
            return;
        }

        // Users can never verify themselves. This only queues the request; an admin approves it
        // (PATCH /admin/verifications/:id), which is what turns the verified badge on.
        const idNumberLast4 = String(idNumber).trim().slice(-4);
        const updated = await db.user.update({
            where: { id: req.user.id },
            data: {
                verificationStatus: 'PENDING_REVIEW',
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
            message: 'Thanks! Your ID has been submitted and will be reviewed shortly.',
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
        const { pushToken } = req.body || {};
        if (!pushToken || typeof pushToken !== 'string' || pushToken.length > 300) {
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

        const outcome = await sendPushWithDiagnostics(
            req.user.id,
            'Kaphor Alert',
            'Phone out-of-app notification is active and working properly!',
            { type: 'TEST_ALERT', url: '/(tabs)/messages' },
            'default'
        );

        let message: string;
        if (outcome.success) {
            message = 'Test notification dispatched to your phone!';
        } else if (!outcome.userHasToken) {
            message = 'No push token registered for your account. Open the Kaphor app on your phone and sign in to register your device.';
        } else if (outcome.tokenKind === 'expo-go') {
            message = 'This device is running via Expo Go, which no longer receives Android push notifications (Expo SDK 53+). Install a development build and open the app once to re-register this phone.';
        } else if (outcome.engine === 'fcm' && !outcome.firebaseReady) {
            message = 'Firebase Admin is not configured on the server. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, then redeploy.';
        } else {
            message = `Push failed: ${outcome.reason || 'unknown error'}`;
        }

        res.json({
            success: outcome.success,
            message,
            diagnostics: {
                tokenKind: outcome.tokenKind,
                engine: outcome.engine,
                firebaseReady: outcome.firebaseReady,
                reason: outcome.reason || null,
            },
            pushTokenSnippet: user.pushToken.slice(0, 20) + '...',
        });
    } catch (error) {
        logger.error('sendTestPushNotification failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}


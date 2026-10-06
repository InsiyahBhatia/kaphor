import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createNotification } from '../services/notification.service';
import { emitToUser, emitToConversation } from '../lib/socket';
import { cacheWrap } from '../lib/cache';
import { setPublicCache } from '../lib/httpCache';

const BLOCKING_RENTAL_STATUSES = ['APPROVED', 'RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED'];

function cleanStr(v: unknown, max: number): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t.slice(0, max) : undefined;
}

function parseJsonObject(v: unknown, maxLen: number): Record<string, unknown> | null | undefined {
    // undefined => invalid; null => absent
    if (v === undefined || v === null || v === '') return null;
    let obj: unknown = v;
    if (typeof v === 'string') {
        if (v.length > maxLen) return undefined;
        try { obj = JSON.parse(v); } catch { return undefined; }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
    if (JSON.stringify(obj).length > maxLen) return undefined;
    return obj as Record<string, unknown>;
}

/**
 * Resolve a rental by its id; falls back to stripeId only among rentals the caller participates in
 * (stripeId is client-influenced, so it must never resolve to someone else's rental).
 */
async function findRentalByRef(ref: string, uid: string, include: any): Promise<any | null> {
    const byId = await db.rental.findUnique({ where: { id: ref }, include });
    if (byId) return byId;
    return db.rental.findFirst({
        where: {
            stripeId: ref,
            OR: [{ renterId: uid }, { garment: { sellerId: uid } }],
        },
        include,
    });
}

export async function getAvailableRentals(req: Request, res: Response): Promise<void> {
    try {
        const { category, startDate, endDate, priceMax, excludeMine } = req.query;
        const currentUserId = (req as any).user?.id;

        const cacheKey = `rentals:available:${JSON.stringify({ category, startDate, endDate, priceMax, excludeMine })}:${currentUserId || 'anon'}`;

        const payload = await cacheWrap(cacheKey, 30_000, async () => {
            // Basic query for garments
            const query: any = {
                listingType: 'RENTAL',
                isActive: true,
                lifecycleState: 'LISTED'
            };

            if (category && typeof category === 'string') {
                query.category = category.slice(0, 100);
            }

            if (priceMax && Number.isFinite(Number(priceMax))) {
                query.rentalPriceDay = { lte: Math.round(Number(priceMax)) };
            }

            // Exclude garments listed by the requesting user only if explicitly requested
            if (currentUserId && excludeMine === 'true') {
                query.sellerId = { not: currentUserId };
            }

            // OPTIMIZATION: Only include rentals (N+1) when date filter is provided
            const hasDateFilter = Boolean(startDate && endDate) &&
                !Number.isNaN(new Date(String(startDate)).getTime()) &&
                !Number.isNaN(new Date(String(endDate)).getTime());

            let garments;

            const RENTAL_GARMENT_SELECT = {
                id: true, title: true, description: true, brand: true,
                category: true, subCategory: true, size: true, color: true,
                material: true, fabric: true, style: true, pattern: true,
                condition: true, images: true, price: true,
                rentalPriceDay: true, rentalPriceWeek: true,
                listingType: true, lifecycleState: true,
                sellerId: true,
                createdAt: true,
                seller: { select: { id: true, displayName: true, avatar: true } },
            };

            if (hasDateFilter) {
                const reqStart = new Date(String(startDate));
                const reqEnd = new Date(String(endDate));

                const allGarments = await db.garment.findMany({
                    where: query,
                    select: {
                        ...RENTAL_GARMENT_SELECT,
                        rentals: {
                            where: { status: { in: ['APPROVED', 'RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED'] } },
                            select: { startDate: true, endDate: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                });

                // Filter out garments with date conflicts
                garments = allGarments
                    .filter((g: any) => !g.rentals.some((r: any) => reqStart <= r.endDate && reqEnd >= r.startDate))
                    .map((g: any) => ({ ...g, rentals: undefined, isLastPiece: true }));
            } else {
                // No date filter — simpler query without the N+1 rentals include
                garments = await db.garment.findMany({
                    where: query,
                    select: RENTAL_GARMENT_SELECT,
                    orderBy: { createdAt: 'desc' },
                    take: 50
                });

                garments = garments.map((g: any) => ({ ...g, isLastPiece: true }));
            }

            // Presign images + seller avatar (bucket is private; raw URLs would 403)
            const { getDownloadUrl, thumbnailUrl } = await import('../lib/cloudinary');
            garments = await Promise.all(
                garments.map(async (g: any) => {
                    const images = Array.isArray(g.images) && g.images.length > 0
                        ? await Promise.all(g.images.slice(0, 3).map((img: string) => getDownloadUrl(img)))
                        : g.images;
                    const avatar = g.seller?.avatar ? await getDownloadUrl(g.seller.avatar) : g.seller?.avatar;
                    return {
                        ...g,
                        images,
                        thumbnailUrl: Array.isArray(images) ? thumbnailUrl(images[0]) : null,
                        seller: g.seller ? { ...g.seller, avatar } : g.seller,
                    };
                })
            );

            return { data: garments };
        });

        setPublicCache(req, res, 30);
        res.json(payload);
    } catch (error) {
        logger.error('Failed to fetch available rentals', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function createRental(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { garmentId, startDate, endDate, days: inputDays, message, shippingAddress, metadata } = req.body || {};

        if (!garmentId || typeof garmentId !== 'string') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Garment ID is required' });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Allow reservations starting today or later (with a 24h grace buffer for global timezone offsets)
        const pastCutoff = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        let reqStart: Date;
        let reqEnd: Date;

        if (startDate && endDate) {
            reqStart = new Date(startDate);
            reqEnd = new Date(endDate);
        } else if (startDate && inputDays) {
            reqStart = new Date(startDate);
            reqEnd = new Date(reqStart);
            reqEnd.setDate(reqEnd.getDate() + Number(inputDays));
        } else if (inputDays && Number.isFinite(Number(inputDays))) {
            reqStart = new Date(today);
            reqEnd = new Date(today);
            reqEnd.setDate(reqEnd.getDate() + Number(inputDays));
        } else {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid dates or rental duration required' });
            return;
        }

        if (Number.isNaN(reqStart.getTime()) || Number.isNaN(reqEnd.getTime())) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid dates' });
            return;
        }
        if (reqStart.getTime() > today.getTime() + 365 * 24 * 60 * 60 * 1000) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Start date is too far in the future' });
            return;
        }

        if (reqStart < pastCutoff) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Start date cannot be in the past' });
            return;
        }

        const days = Math.ceil((reqEnd.getTime() - reqStart.getTime()) / (1000 * 3600 * 24));
        if (days <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid date range' });
            return;
        }

        if (days > 30) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Rental period cannot exceed 30 days' });
            return;
        }

        const garment = await db.garment.findUnique({
            where: { id: String(garmentId) },
            include: {
                rentals: {
                    where: { status: { in: BLOCKING_RENTAL_STATUSES as any } }
                }
            }
        });

        if (!garment || (!garment.rentalPriceDay && !garment.rentalPriceWeek)) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental garment not found' });
            return;
        }

        if (garment.sellerId === req.user.id) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot rent your own garment' });
            return;
        }

        if (!garment.isActive || garment.lifecycleState !== 'LISTED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'This garment is not available for rent' });
            return;
        }

        const parsedShipping = parseJsonObject(shippingAddress, 4000);
        const parsedMeta = parseJsonObject(metadata, 4000);
        if (parsedShipping === undefined || parsedMeta === undefined) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid shipping address or metadata' });
            return;
        }
        if (parsedMeta) {
            // Server-owned keys must not be client-controlled
            delete (parsedMeta as any).reviews;
        }

        // Check for conflicts
        const hasConflict = garment.rentals.some((rental: any) => {
            const rStart = new Date(rental.startDate);
            const rEnd = new Date(rental.endDate);
            return (reqStart <= rEnd && reqEnd >= rStart);
        });

        if (hasConflict) {
            res.status(400).json({ error: 'CONFLICT', message: 'Garment is already rented for these dates' });
            return;
        }

        const rawDayRate = garment.rentalPriceDay || 0;
        const rawWeekRate = garment.rentalPriceWeek || 0;

        const dailyRateInRupees = rawDayRate || 149;
        const weekRateInRupees = rawWeekRate || dailyRateInRupees * 5;

        let rentalFeeInRupees: number;
        if (days >= 7 && weekRateInRupees > 0) {
            const weeks = Math.floor(days / 7);
            const remainderDays = days % 7;
            rentalFeeInRupees = weeks * weekRateInRupees + remainderDays * dailyRateInRupees;
        } else {
            rentalFeeInRupees = dailyRateInRupees * days;
        }

        const amount = rentalFeeInRupees; // stored in pure whole Rupees (₹)

        if (amount <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid rental pricing' });
            return;
        }

        const initialHistory = [
            {
                status: 'REQUESTED',
                timestamp: new Date().toISOString(),
                note: 'Rental request submitted by borrower. Awaiting lender approval.'
            }
        ];

        const rental = await db.rental.create({
            data: {
                garmentId: garment.id,
                renterId: req.user.id,
                startDate: reqStart,
                endDate: reqEnd,
                totalPrice: amount,
                status: 'REQUESTED',
                message: typeof message === 'string' && message.trim().length > 0 ? message.trim().slice(0, 2000) : null,
                shippingAddress: (parsedShipping ?? null) as any,
                metadata: (parsedMeta ?? null) as any,
                trackingHistory: initialHistory,
            },
            include: {
                garment: {
                    select: {
                        id: true,
                        title: true,
                        brand: true,
                        images: true,
                        rentalPriceDay: true,
                        sellerId: true,
                    }
                }
            }
        });

        // Notify owner about initial reservation request
        try {
            const renterName = (req.user as any).displayName || (req.user as any).username || 'A verified member';
            await createNotification({
                userId: garment.sellerId,
                type: 'RENTAL_RESERVED',
                title: '👗 New Rental Request',
                body: `${renterName} requested to rent "${garment.title}" for ${days} days. Please review and approve.`,
                data: { rentalId: rental.id, garmentId: garment.id, targetRoute: `/(tabs)/rental/lease/${rental.id}` },
            });
            emitToUser(garment.sellerId, 'rental:requested', { rentalId: rental.id, garmentId: garment.id });

            // Reuse or link existing direct conversation thread for this garment and rental transaction
            let conv = await db.conversation.findFirst({
                where: {
                    garmentId: garment.id,
                    OR: [
                        { participant1Id: req.user.id, participant2Id: garment.sellerId },
                        { participant1Id: garment.sellerId, participant2Id: req.user.id },
                    ],
                },
            });
            if (conv) {
                await db.conversation.update({
                    where: { id: conv.id },
                    data: { rentalId: rental.id, type: 'RENTAL' },
                });
            } else {
                conv = await db.conversation.create({
                    data: {
                        participant1Id: req.user.id,
                        participant2Id: garment.sellerId,
                        garmentId: garment.id,
                        rentalId: rental.id,
                        type: 'RENTAL',
                    },
                });
            }
            const reservationText = `👗 [RENTAL RESERVATION] Initiated a ${days}-day rental request for "${garment.title}".\n• Dates: ${new Date(reqStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${new Date(reqEnd).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}\n• Estimated Total: ₹${amount.toLocaleString()}\n• Lease ID: ${rental.id}`;
            const chatMsg = await db.directMessage.create({
                data: {
                    conversationId: conv.id,
                    senderId: req.user.id,
                    recipientId: garment.sellerId,
                    content: reservationText,
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
                    lastMessageText: reservationText.slice(0, 100),
                    lastMessageAt: new Date(),
                    garmentId: garment.id,
                    rentalId: rental.id,
                },
            });
            emitToConversation(conv.id, 'direct_message', chatMsg);
            emitToUser(garment.sellerId, 'new_direct_message', { conversationId: conv.id, message: chatMsg });
        } catch (notifErr) {
            logger.warn('Failed to send rental reserved notification / chat message', { error: notifErr });
        }

        res.status(201).json({
            data: {
                id: rental.id,
                rentalOrderId: rental.id,
                rentalId: rental.id,
                amount,
                days,
                startDate: rental.startDate,
                endDate: rental.endDate,
                shippingAddress: rental.shippingAddress,
                garment: rental.garment,
            }
        });
    } catch (error) {
        logger.error('Failed to create rental', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create rental reservation' });
    }
}

/**
 * Calculates rental breakdown (fee, deposit, insurance, delivery) in paise
 * Called by frontend before checkout.
 */
export async function calculateRentalBreakdown(req: Request, res: Response): Promise<void> {
    try {
        const { garmentId, days: daysInput } = req.body || {};
        if (!garmentId || typeof garmentId !== 'string') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'garmentId is required' });
            return;
        }

        const days = Math.max(1, Math.min(30, Math.floor(Number(daysInput)) || 3));

        const garment = await db.garment.findUnique({
            where: { id: String(garmentId) },
            select: { id: true, title: true, rentalPriceDay: true, rentalPriceWeek: true, price: true }
        });

        if (!garment || (!garment.rentalPriceDay && !garment.rentalPriceWeek)) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental garment not found' });
            return;
        }

        const rawDayRate = garment.rentalPriceDay || 0;
        const rawWeekRate = garment.rentalPriceWeek || 0;

        const dailyRateInRupees = rawDayRate || 149;
        const weekRateInRupees = rawWeekRate || dailyRateInRupees * 5;

        let rentalFeeInRupees: number;
        if (days >= 7 && weekRateInRupees > 0) {
            const weeks = Math.floor(days / 7);
            const remainderDays = days % 7;
            rentalFeeInRupees = weeks * weekRateInRupees + remainderDays * dailyRateInRupees;
        } else {
            rentalFeeInRupees = dailyRateInRupees * days;
        }

        // All amounts in pure whole Rupees (₹)
        const rentalFee = rentalFeeInRupees;
        const securityDeposit = 299; // Flat minimal refundable deposit of ₹299 for thrifting
        const insuranceFee = 49; // Flat ₹49 optional damage waiver
        const deliveryFee = 199; // ₹199 standard insured delivery
        const totalAmount = rentalFee + securityDeposit + insuranceFee + deliveryFee;

        res.json({
            data: {
                rentalDays: days,
                dailyRate: dailyRateInRupees,
                rentalFee,
                securityDeposit,
                insuranceFee,
                deliveryFee,
                totalAmount,
            }
        });
    } catch (error) {
        logger.error('calculateRentalBreakdown failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to calculate rental breakdown' });
    }
}

/**
 * Escrow status for rental security deposit
 */
export async function getRentalEscrow(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const cleanId = String(id || '').trim();
        const rental = await findRentalByRef(cleanId, req.user.id, { garment: { select: GARMENT_LIST_COLUMNS } });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.renterId !== req.user.id && rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
            return;
        }

        const depositAmount = 29900; // Flat ₹299 minimal refundable deposit
        const isReleased = rental.status === 'RETURNED';

        res.json({
            data: {
                id: `escrow_${rental.id}`,
                rentalId: rental.id,
                amount: depositAmount,
                status: isReleased ? 'RELEASED' : 'HELD',
                heldAt: rental.createdAt.toISOString(),
                releasedAt: isReleased ? rental.updatedAt.toISOString() : undefined,
            }
        });
    } catch (error) {
        logger.error('getRentalEscrow failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

/**
 * Release security deposit back to renter after successful return & inspection
 */
export async function releaseRentalDeposit(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const cleanId = String(id || '').trim();
        const rental = await findRentalByRef(cleanId, req.user.id, { garment: { select: GARMENT_LIST_COLUMNS } });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only garment owner or admin can release deposit' });
            return;
        }

        if (rental.status !== 'RETURNED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Item must be returned before releasing deposit' });
            return;
        }

        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        // Atomic status guard: a deposit can only be released once.
        const released = await db.rental.updateMany({
            where: { id: rental.id, status: 'RETURNED' },
            data: {
                status: 'COMPLETED',
                depositRefundedAt: new Date(),
                trackingHistory: [
                    ...currentHistory,
                    { status: 'COMPLETED', timestamp: new Date().toISOString(), note: 'Garment inspected. ₹299 security deposit released to renter. Rental complete.' }
                ]
            }
        });
        if (released.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Deposit already released or rental state changed' });
            return;
        }

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_RETURNED',
                title: '✨ Security Deposit Refunded',
                body: `Your ₹299 security deposit for "${rental.garment.title}" has been released back to your account.`,
                data: { rentalId: rental.id, targetRoute: `/(tabs)/rental/lease/${rental.id}` },
            });

            // Prompt Renter to review the Lender/Piece
            await createNotification({
                userId: rental.renterId,
                type: 'PEER_REVIEW',
                title: '⭐ Rate Your Rental Experience',
                body: `Your lease for "${rental.garment.title}" is complete! Leave a review for the owner.`,
                data: { rentalId: rental.id, targetRoute: `/(tabs)/rental/lease/${rental.id}?review=true` },
            });

            // Prompt Lender to review the Borrower
            if (rental.garment?.sellerId) {
                await createNotification({
                    userId: rental.garment.sellerId,
                    type: 'PEER_REVIEW',
                    title: '⭐ Rate Your Rental Partner',
                    body: `Rental complete for "${rental.garment.title}". Leave a review for the borrower.`,
                    data: { rentalId: rental.id, targetRoute: `/(tabs)/rental/lease/${rental.id}?review=true` },
                });
            }
        } catch (notifErr) {
            logger.warn('Failed to send rental deposit refund notification', { error: notifErr });
        }

        res.json({
            data: {
                rentalId: rental.id,
                status: 'COMPLETED',
                escrowStatus: 'RELEASED',
                refundedAmount: 29900,
                releasedAt: new Date().toISOString(),
            }
        });
    } catch (error) {
        logger.error('releaseRentalDeposit failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getMyRentals(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const role = (req.query.role as string || 'all').toLowerCase();
        const uid = req.user.id;

        let whereClause: any;
        if (role === 'renter') {
            whereClause = { renterId: uid };
        } else if (role === 'lender') {
            whereClause = { garment: { sellerId: uid } };
        } else {
            whereClause = {
                OR: [
                    { renterId: uid },
                    { garment: { sellerId: uid } }
                ]
            };
        }

        const rawRentals = await db.rental.findMany({
            where: whereClause,
            include: {
                garment: {
                    select: {
                        id: true, title: true, brand: true, images: true,
                        category: true, price: true, rentalPriceDay: true,
                        rentalPriceWeek: true, condition: true, listingType: true,
                        sellerId: true,
                        seller: {
                            select: { id: true, displayName: true, username: true, avatar: true }
                        }
                    }
                },
                renter: {
                    select: { id: true, displayName: true, username: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const { getDownloadUrl } = await import('../lib/cloudinary');
        const rentals = await Promise.all(
            rawRentals.map(async (rental: any) => {
                const userRole = rental.renterId === uid ? 'RENTER' : 'LENDER';
                if (userRole === 'LENDER' && ['REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED'].includes(String(rental.status))) {
                    rental = { ...rental, shippingAddress: null };
                }
                let resolvedImages = rental.garment?.images || [];
                if (Array.isArray(resolvedImages) && resolvedImages.length > 0) {
                    resolvedImages = await Promise.all(resolvedImages.map((img: string) => getDownloadUrl(img)));
                }
                let renterAvatar = rental.renter?.avatar;
                if (renterAvatar) renterAvatar = await getDownloadUrl(renterAvatar);
                let lenderAvatar = rental.garment?.seller?.avatar;
                if (lenderAvatar) lenderAvatar = await getDownloadUrl(lenderAvatar);

                return {
                    ...rental,
                    userRole,
                    garment: rental.garment ? {
                        ...rental.garment,
                        images: resolvedImages,
                        seller: rental.garment.seller ? { ...rental.garment.seller, avatar: lenderAvatar } : undefined,
                    } : null,
                    renter: rental.renter ? { ...rental.renter, avatar: renterAvatar } : null,
                };
            })
        );

        res.json({ data: rentals });
    } catch (error) {
        logger.error('Failed to fetch rentals', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getRentalById(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const cleanId = String(id || '').trim();
        const uid = req.user.id;

        if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid Rental ID required' });
            return;
        }

        let rental = await db.rental.findFirst({
            where: {
                OR: [
                    { id: cleanId },
                    { stripeId: cleanId, renterId: uid },
                    { stripeId: cleanId, garment: { sellerId: uid } },
                    { garmentId: cleanId, renterId: uid },
                    { garmentId: cleanId, garment: { sellerId: uid } },
                ]
            },
            include: {
                garment: {
                    select: {
                        id: true,
                        title: true,
                        brand: true,
                        images: true,
                        category: true,
                        price: true,
                        rentalPriceDay: true,
                        rentalPriceWeek: true,
                        condition: true,
                        listingType: true,
                        sellerId: true,
                        seller: {
                            select: { id: true, displayName: true, username: true, avatar: true, phone: true, email: true }
                        }
                    }
                },
                renter: {
                    select: { id: true, displayName: true, username: true, avatar: true, phone: true, email: true }
                }
            }
        });

        // Fallback: check if cleanId is a conversation ID that has an associated rental
        if (!rental) {
            const conv = await db.conversation.findUnique({
                where: { id: cleanId },
            });
            if (conv && conv.rentalId) {
                rental = await db.rental.findUnique({
                    where: { id: conv.rentalId },
                    include: {
                        garment: {
                            select: {
                                id: true,
                                title: true,
                                brand: true,
                                images: true,
                                category: true,
                                price: true,
                                rentalPriceDay: true,
                                rentalPriceWeek: true,
                                condition: true,
                                listingType: true,
                                sellerId: true,
                                seller: {
                                    select: { id: true, displayName: true, username: true, avatar: true, phone: true, email: true }
                                }
                            }
                        },
                        renter: {
                            select: { id: true, displayName: true, username: true, avatar: true, phone: true, email: true }
                        }
                    }
                });
            }
        }

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        const isRenter = rental.renterId === uid;
        const isLender = rental.garment?.sellerId === uid;
        const isAdmin = (req.user as any).role === 'ADMIN';

        if (!isRenter && !isLender && !isAdmin) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to view this rental' });
            return;
        }

        const userRole = isRenter ? 'RENTER' : 'LENDER';

        // Counterparty contact details / shipping address are revealed only once the deal progresses.
        const status = String(rental.status);
        const pastApproval = !['REQUESTED', 'DECLINED', 'CANCELLED', 'EXPIRED'].includes(status);
        const paid = !['REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED', 'EXPIRED'].includes(status);
        const safeRental: any = { ...rental };
        if (!isAdmin) {
            if (isLender && !isRenter) {
                if (!paid) safeRental.shippingAddress = null;
                if (safeRental.renter && !pastApproval) safeRental.renter = { ...safeRental.renter, phone: null, email: null };
            } else if (isRenter && !isLender) {
                if (safeRental.garment?.seller && !paid) {
                    safeRental.garment = { ...safeRental.garment, seller: { ...safeRental.garment.seller, phone: null, email: null } };
                }
            }
        }

        const { getDownloadUrl } = await import('../lib/cloudinary');
        let resolvedImages = safeRental.garment?.images || [];
        if (Array.isArray(resolvedImages) && resolvedImages.length > 0) {
            resolvedImages = await Promise.all(resolvedImages.map((img: string) => getDownloadUrl(img)));
        }
        let renterAvatar = safeRental.renter?.avatar;
        if (renterAvatar) renterAvatar = await getDownloadUrl(renterAvatar);
        let lenderAvatar = safeRental.garment?.seller?.avatar;
        if (lenderAvatar) lenderAvatar = await getDownloadUrl(lenderAvatar);

        res.json({
            data: {
                ...safeRental,
                userRole,
                garment: safeRental.garment ? {
                    ...safeRental.garment,
                    images: resolvedImages,
                    seller: safeRental.garment.seller ? { ...safeRental.garment.seller, avatar: lenderAvatar } : undefined,
                } : null,
                renter: safeRental.renter ? { ...safeRental.renter, avatar: renterAvatar } : null,
            }
        });
    } catch (error) {
        logger.error('Failed to get rental by id', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch rental details' });
    }
}

export async function approveRentalRequest(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental request not found' });
            return;
        }

        if (rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only the garment owner can approve this rental request' });
            return;
        }

        if (rental.status !== 'REQUESTED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot approve rental in status: ${rental.status}` });
            return;
        }

        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        // Re-check availability: the garment must still be listed and no overlapping booking may exist.
        if (!rental.garment.isActive || rental.garment.lifecycleState !== 'LISTED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Garment is no longer available' });
            return;
        }
        const overlapping = await db.rental.findFirst({
            where: {
                garmentId: rental.garmentId,
                id: { not: rental.id },
                status: { in: BLOCKING_RENTAL_STATUSES as any },
                startDate: { lte: rental.endDate },
                endDate: { gte: rental.startDate },
            },
            select: { id: true },
        });
        if (overlapping) {
            res.status(409).json({ error: 'CONFLICT', message: 'Garment is already booked for these dates' });
            return;
        }
        const apr = await db.rental.updateMany({
            where: { id, status: 'REQUESTED' },
            data: {
                status: 'APPROVED',
                approvedAt: new Date(),
                trackingHistory: [
                    ...currentHistory,
                    { status: 'APPROVED', timestamp: new Date().toISOString(), note: 'Rental request approved by lender. 24-hour payment window opened.' }
                ]
            },
        });
        if (apr.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_ACTIVE',
                title: '✨ Rental Request Approved!',
                body: `Your rental request for "${rental.garment.title}" has been approved by the owner! Complete payment to secure your dates.`,
                data: { rentalId: rental.id, garmentId: rental.garmentId, targetRoute: `/(tabs)/rental/lease/${rental.id}` },
            });
            emitToUser(rental.renterId, 'rental:approved', { rentalId: rental.id, garmentId: rental.garmentId });

            // Post approval into direct message thread
            let conv = await db.conversation.findFirst({
                where: { rentalId: rental.id },
            });
            if (!conv) {
                conv = await db.conversation.findFirst({
                    where: {
                        OR: [
                            { participant1Id: rental.renterId, participant2Id: rental.garment.sellerId, garmentId: rental.garmentId },
                            { participant1Id: rental.garment.sellerId, participant2Id: rental.renterId, garmentId: rental.garmentId },
                        ],
                    },
                });
            }
            if (conv) {
                const approveText = `✨ [RENTAL APPROVED] I have approved your rental dates for "${rental.garment.title}"! You can now proceed to payment in the rental details.\n• Lease ID: ${rental.id}`;
                const chatMsg = await db.directMessage.create({
                    data: {
                        conversationId: conv.id,
                        senderId: req.user.id,
                        recipientId: rental.renterId,
                        content: approveText,
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
                        lastMessageText: approveText.slice(0, 100),
                        lastMessageAt: new Date(),
                        rentalId: rental.id,
                    },
                });
                emitToConversation(conv.id, 'direct_message', chatMsg);
                emitToUser(rental.renterId, 'new_direct_message', { conversationId: conv.id, message: chatMsg });
            }
        } catch (notifErr) {
            logger.warn('Failed to send rental approved notification', { error: notifErr });
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to approve rental request', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to approve rental request' });
    }
}

export async function declineRentalRequest(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const reason = cleanStr((req.body || {}).reason, 1000);

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental request not found' });
            return;
        }

        if (rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only the garment owner can decline this rental request' });
            return;
        }

        if (rental.status !== 'REQUESTED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot decline rental in status: ${rental.status}` });
            return;
        }

        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        const dec = await db.rental.updateMany({
            where: { id, status: 'REQUESTED' },
            data: {
                status: 'DECLINED',
                declineReason: reason ?? null,
                trackingHistory: [
                    ...currentHistory,
                    { status: 'DECLINED', timestamp: new Date().toISOString(), note: reason ? `Declined by lender: ${reason}` : 'Declined by lender' }
                ]
            },
        });
        if (dec.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_RETURNED',
                title: 'Rental Request Declined',
                body: `Your rental request for "${rental.garment.title}" could not be accommodated at this time${reason ? `: "${reason}"` : '.'}`,
                data: { rentalId: rental.id, garmentId: rental.garmentId, targetRoute: `/(tabs)/rental/lease/${rental.id}` },
            });
            emitToUser(rental.renterId, 'rental:declined', { rentalId: rental.id, garmentId: rental.garmentId });

            // Post decline note into chat
            let conv = await db.conversation.findFirst({
                where: { rentalId: rental.id },
            });
            if (!conv) {
                conv = await db.conversation.findFirst({
                    where: {
                        OR: [
                            { participant1Id: rental.renterId, participant2Id: rental.garment.sellerId, garmentId: rental.garmentId },
                            { participant1Id: rental.garment.sellerId, participant2Id: rental.renterId, garmentId: rental.garmentId },
                        ],
                    },
                });
            }
            if (conv) {
                const declineText = `⚠️ [RENTAL DECLINED] Rental request for "${rental.garment.title}" could not be accommodated${reason ? `: "${reason}"` : '.'}`;
                const chatMsg = await db.directMessage.create({
                    data: {
                        conversationId: conv.id,
                        senderId: req.user.id,
                        recipientId: rental.renterId,
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
                emitToConversation(conv.id, 'direct_message', chatMsg);
                emitToUser(rental.renterId, 'new_direct_message', { conversationId: conv.id, message: chatMsg });
            }
        } catch (notifErr) {
            logger.warn('Failed to send rental declined notification', { error: notifErr });
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to decline rental request', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to decline rental request' });
    }
}

export async function confirmRentalPayment(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const { paymentId, razorpayOrderId } = req.body || {};

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.renterId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to pay for this rental' });
            return;
        }

        const isAdmin = (req.user as any).role === 'ADMIN';

        // Payment is verified server-side by the Razorpay verify endpoint (which sets paidAt/RESERVED).
        // A client assertion alone must never mark a rental as paid.
        if (!isAdmin) {
            if (rental.paidAt && rental.status !== 'APPROVED' && rental.status !== 'REQUESTED') {
                res.json({ data: rental });
                return;
            }
            res.status(402).json({ error: 'PAYMENT_NOT_VERIFIED', message: 'Payment has not been verified yet' });
            return;
        }

        if (rental.status !== 'APPROVED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot confirm payment for rental in status: ${rental.status}` });
            return;
        }

        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        const pay = await db.rental.updateMany({
            where: { id, status: 'APPROVED' },
            data: {
                status: 'RESERVED',
                paidAt: new Date(),
                stripeId: cleanStr(razorpayOrderId, 100) || cleanStr(paymentId, 100) || rental.stripeId,
                trackingHistory: [
                    ...currentHistory,
                    { status: 'RESERVED', timestamp: new Date().toISOString(), note: 'Payment verified and held safely until delivery. Waiting for the garment to ship.' }
                ]
            },
        });
        if (pay.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        try {
            await createNotification({
                userId: rental.garment.sellerId,
                type: 'RENTAL_RESERVED',
                title: '💳 Payment Secured!',
                body: `Borrower completed payment for "${rental.garment.title}". Please prepare the piece for dispatch.`,
                data: { rentalId: rental.id, garmentId: rental.garmentId },
            });
        } catch (notifErr) {
            logger.warn('Failed to send rental paid notification', { error: notifErr });
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to confirm rental payment', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm rental payment' });
    }
}

export async function dispatchRental(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const trackingNumber = cleanStr((req.body || {}).trackingNumber, 100);
        const carrier = cleanStr((req.body || {}).carrier, 100);

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only the garment lender can mark rental as dispatched' });
            return;
        }

        // Only a paid (RESERVED) rental may be dispatched; APPROVED means payment has not happened yet.
        if (rental.status !== 'RESERVED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot dispatch rental in status: ${rental.status}` });
            return;
        }

        const selectedCarrier = carrier || 'BlueDart';
        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        const disp = await db.rental.updateMany({
            where: { id, status: 'RESERVED' },
            data: {
                status: 'DISPATCHED',
                trackingNumber: trackingNumber || null,
                carrier: selectedCarrier,
                dispatchedAt: new Date(),
                trackingHistory: [
                    ...currentHistory,
                    {
                        status: 'DISPATCHED',
                        timestamp: new Date().toISOString(),
                        note: trackingNumber
                            ? `Dispatched via ${selectedCarrier} (AWB: ${trackingNumber})`
                            : `Dispatched via ${selectedCarrier}`
                    }
                ]
            },
        });
        if (disp.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_ACTIVE',
                title: '🚚 Rental Dispatched!',
                body: `"${rental.garment.title}" has been dispatched by the owner (${selectedCarrier}${trackingNumber ? ` • ${trackingNumber}` : ''}). Track your delivery in the app!`,
                data: { rentalId: id, trackingNumber, carrier: selectedCarrier },
            });
        } catch (notifErr) {
            logger.warn('Failed to send rental dispatched notification', { error: notifErr });
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to dispatch rental', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to dispatch rental' });
    }
}

export async function confirmRentalDelivery(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.renterId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only the borrower can confirm receiving the garment' });
            return;
        }

        // Delivery can only be confirmed after the lender has dispatched.
        if (rental.status !== 'DISPATCHED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot confirm delivery for status: ${rental.status}` });
            return;
        }

        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        const dlv = await db.rental.updateMany({
            where: { id, status: 'DISPATCHED' },
            data: {
                status: 'ACTIVE',
                deliveredAt: new Date(),
                trackingHistory: [
                    ...currentHistory,
                    { status: 'ACTIVE', timestamp: new Date().toISOString(), note: 'Delivery confirmed by borrower. Active lease period officially started.' }
                ]
            },
        });
        if (dlv.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        try {
            await createNotification({
                userId: rental.garment.sellerId,
                type: 'RENTAL_ACTIVE',
                title: '📦 Garment Delivered & Active!',
                body: `Borrower has confirmed receipt of "${rental.garment.title}". Active lease duration is now running.`,
                data: { rentalId: rental.id, garmentId: rental.garmentId },
            });
        } catch (notifErr) {
            logger.warn('Failed to send rental delivery confirmed notification', { error: notifErr });
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to confirm delivery', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm delivery' });
    }
}

export async function returnRental(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const returnTracking = cleanStr((req.body || {}).returnTracking, 100);
        const returnCarrier = cleanStr((req.body || {}).returnCarrier, 100);

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        if (rental.renterId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to return this rental' });
            return;
        }

        if (rental.status !== 'ACTIVE' && rental.status !== 'DISPATCHED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot initiate return in status: ${rental.status}` });
            return;
        }

        const selectedCarrier = returnCarrier || 'Delhivery';
        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        const ret = await db.rental.updateMany({
            where: { id, status: rental.status },
            data: {
                status: 'RETURN_DISPATCHED',
                returnTracking: returnTracking || null,
                returnCarrier: selectedCarrier,
                returnDispatchedAt: new Date(),
                trackingHistory: [
                    ...currentHistory,
                    {
                        status: 'RETURN_DISPATCHED',
                        timestamp: new Date().toISOString(),
                        note: returnTracking
                            ? `Return package dispatched via ${selectedCarrier} (AWB: ${returnTracking})`
                            : `Return package dispatched via ${selectedCarrier}`
                    }
                ]
            },
        });
        if (ret.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        if (updated?.garment) {
            try {
                await createNotification({
                    userId: updated.garment.sellerId,
                    type: 'RENTAL_RETURNED',
                    title: '🔁 Return Shipment Dispatched',
                    body: `"${updated.garment.title}" has been dispatched back by borrower (${selectedCarrier}${returnTracking ? ` • ${returnTracking}` : ''}). Track return in app!`,
                    data: { rentalId: id, returnTracking, returnCarrier: selectedCarrier },
                });
            } catch (notifErr) {
                logger.warn('Failed to send rental return notification', { error: notifErr });
            }
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to mark rental returned', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function confirmReturnDelivery(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only the garment owner can confirm return receipt' });
            return;
        }

        if (rental.status !== 'RETURN_DISPATCHED' && rental.status !== 'ACTIVE') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot confirm return receipt for status: ${rental.status}` });
            return;
        }

        const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
        const rcv = await db.rental.updateMany({
            where: { id, status: rental.status },
            data: {
                status: 'RETURNED',
                returnDeliveredAt: new Date(),
                trackingHistory: [
                    ...currentHistory,
                    { status: 'RETURNED', timestamp: new Date().toISOString(), note: 'Return package delivered to owner. 48-hour inspection window active.' }
                ]
            },
        });
        if (rcv.count !== 1) {
            res.status(409).json({ error: 'CONFLICT', message: 'Rental state changed, please refresh' });
            return;
        }
        const updated = await db.rental.findUnique({ where: { id }, include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true } });

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_RETURNED',
                title: '✨ Return Delivered to Owner',
                body: `The owner received "${rental.garment.title}". Condition inspection is underway before deposit release.`,
                data: { rentalId: rental.id, garmentId: rental.garmentId },
            });
        } catch (notifErr) {
            logger.warn('Failed to send return received notification', { error: notifErr });
        }

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to confirm return delivery', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm return delivery' });
    }
}

export async function postRentalReview(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const rating = (req.body || {}).rating;
        const comment = cleanStr((req.body || {}).comment, 2000);
        const numRating = typeof rating === 'number' || typeof rating === 'string' ? Number(rating) : NaN;

        if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Rating must be an integer 1–5' });
            return;
        }

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: { select: GARMENT_LIST_COLUMNS }, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.renterId !== req.user.id && rental.garment?.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to review this rental' });
            return;
        }

        if (rental.status !== 'RETURNED' && rental.status !== 'COMPLETED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Rental must be returned before it can be reviewed' });
            return;
        }

        const isRenter = rental.renterId === req.user.id;
        const targetUserId = isRenter ? rental.garment.sellerId : rental.renterId;

        // Persist review in rental metadata
        const currentMeta = (rental.metadata && typeof rental.metadata === 'object') ? (rental.metadata as any) : {};
        const reviews = currentMeta.reviews || {};
        const reviewRecord = {
            id: `rental_rev_${Date.now()}`,
            reviewerId: req.user.id,
            reviewerName: (req.user as any).displayName || (req.user as any).username || 'Rental Partner',
            rating: numRating,
            comment: comment ?? null,
            createdAt: new Date().toISOString(),
            role: isRenter ? 'RENTER' : 'LENDER',
        };
        reviews[req.user.id] = reviewRecord;

        await db.rental.update({
            where: { id },
            data: {
                metadata: {
                    ...currentMeta,
                    reviews,
                }
            }
        });

        // Also upsert into db.review so it links to the garment and counts in ratings
        // Only the renter reviews the garment (a lender must not rate their own listing)
        if (rental.garmentId && isRenter) {
            try {
                await db.review.upsert({
                    where: {
                        userId_garmentId: {
                            userId: req.user.id,
                            garmentId: rental.garmentId,
                        }
                    },
                    create: {
                        userId: req.user.id,
                        garmentId: rental.garmentId,
                        rating: numRating,
                        comment: comment ?? null,
                    },
                    update: {
                        rating: numRating,
                        comment: comment ?? null,
                    }
                });
            } catch (rErr) {
                logger.warn('Failed to upsert db.review for rental garment', { error: rErr });
            }
        }

        // Send Notification to reviewed party
        try {
            await createNotification({
                userId: targetUserId,
                type: 'PEER_REVIEW',
                title: '⭐️ New Rental Review!',
                body: `${(req.user as any).displayName || 'Your rental partner'} left you a ${numRating}-star review for "${rental.garment?.title || 'the rental asset'}".`,
                data: { rentalId: id, rating: numRating, userId: targetUserId, targetRoute: `/(tabs)/rental/lease/${id}?review=true` }
            });
            emitToUser(targetUserId, 'rental:reviewed', { rentalId: id, rating: numRating });
        } catch (notifErr) {
            logger.warn('Failed to send rental review notification', { error: notifErr });
        }

        res.status(201).json({ success: true, data: reviewRecord });
    } catch (error: any) {
        logger.error('postRentalReview failed', { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to submit review' });
    }
}

export async function checkRentalAvailability(req: Request, res: Response): Promise<void> {
    try {
        const { garmentId, startDate, endDate } = req.query;

        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Garment ID is required' });
            return;
        }

        const garment = await db.garment.findUnique({
            where: { id: String(garmentId) },
            select: {
                id: true,
                title: true,
                sellerId: true,
                listingType: true,
                lifecycleState: true,
                isActive: true,
                rentalPriceDay: true,
                rentalPriceWeek: true,
                rentals: {
                    where: { status: { in: ['APPROVED', 'RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED'] } },
                    select: { startDate: true, endDate: true }
                }
            }
        });

        if (!garment) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
            return;
        }

        const bookedRanges = (garment.rentals || []).map((r: any) => ({
            startDate: r.startDate,
            endDate: r.endDate,
        }));

        let isAvailable = garment.isActive && garment.lifecycleState === 'LISTED';

        if (isAvailable && startDate && endDate) {
            const reqStart = new Date(String(startDate));
            const reqEnd = new Date(String(endDate));
            const hasConflict = bookedRanges.some((r: any) => {
                const bStart = new Date(r.startDate);
                const bEnd = new Date(r.endDate);
                return (reqStart <= bEnd && reqEnd >= bStart);
            });
            if (hasConflict) {
                isAvailable = false;
            }
        }

        res.json({
            data: {
                garmentId: garment.id,
                sellerId: garment.sellerId,
                isAvailable,
                bookedRanges,
                rentalPriceDay: garment.rentalPriceDay,
                rentalPriceWeek: garment.rentalPriceWeek,
            }
        });
    } catch (error: any) {
        logger.error('checkRentalAvailability failed', { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to check availability' });
    }
}


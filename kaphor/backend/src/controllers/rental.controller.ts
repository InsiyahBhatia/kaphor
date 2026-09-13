import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createNotification } from '../services/notification.service';

export async function getAvailableRentals(req: Request, res: Response): Promise<void> {
    try {
        const { category, startDate, endDate, priceMax, excludeMine } = req.query;

        // Basic query for garments
        const query: any = {
            listingType: 'RENTAL',
            isActive: true,
            lifecycleState: 'LISTED'
        };

        if (category) {
            query.category = String(category);
        }

        if (priceMax) {
            query.rentalPriceDay = { lte: Math.round(Number(priceMax)) };
        }

        // Exclude garments listed by the requesting user only if explicitly requested
        const currentUserId = (req as any).user?.id;
        if (currentUserId && excludeMine === 'true') {
            query.sellerId = { not: currentUserId };
        }

        // OPTIMIZATION: Only include rentals (N+1) when date filter is provided
        const hasDateFilter = Boolean(startDate && endDate);

        let garments;

        if (hasDateFilter) {
            const reqStart = new Date(String(startDate));
            const reqEnd = new Date(String(endDate));

            const allGarments = await db.garment.findMany({
                where: query,
                include: {
                    rentals: {
                        where: { status: { in: ['RESERVED', 'ACTIVE'] } },
                        select: { startDate: true, endDate: true },
                    },
                    seller: { select: { id: true, displayName: true, avatar: true } },
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
                select: {
                    id: true, title: true, description: true, brand: true,
                    category: true, subCategory: true, size: true, color: true,
                    material: true, fabric: true, style: true, pattern: true,
                    condition: true, images: true, price: true,
                    rentalPriceDay: true, rentalPriceWeek: true,
                    listingType: true, lifecycleState: true,
                    sellerId: true,
                    createdAt: true,
                    seller: { select: { id: true, displayName: true, avatar: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            garments = garments.map((g: any) => ({ ...g, isLastPiece: true }));
        }

        // Presign images + seller avatar (bucket is private; raw URLs would 403)
        const { getDownloadUrl } = await import('../lib/s3');
        garments = await Promise.all(
            garments.map(async (g: any) => {
                const images = Array.isArray(g.images) && g.images.length > 0
                    ? await Promise.all(g.images.map((img: string) => getDownloadUrl(img)))
                    : g.images;
                const avatar = g.seller?.avatar ? await getDownloadUrl(g.seller.avatar) : g.seller?.avatar;
                return {
                    ...g,
                    images,
                    seller: g.seller ? { ...g.seller, avatar } : g.seller,
                };
            })
        );

        res.json({ data: garments });
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

        const { garmentId, startDate, endDate, days: inputDays, message, shippingAddress, metadata } = req.body;

        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Garment ID is required' });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let reqStart: Date;
        let reqEnd: Date;

        if (startDate && endDate) {
            reqStart = new Date(startDate);
            reqEnd = new Date(endDate);
        } else if (startDate && inputDays) {
            reqStart = new Date(startDate);
            reqEnd = new Date(reqStart);
            reqEnd.setDate(reqEnd.getDate() + Number(inputDays));
        } else if (inputDays) {
            reqStart = new Date(tomorrow);
            reqEnd = new Date(tomorrow);
            reqEnd.setDate(reqEnd.getDate() + Number(inputDays));
        } else {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid dates or rental duration required' });
            return;
        }

        if (reqStart < tomorrow) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Start date must be at least tomorrow' });
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
                    where: { status: { in: ['RESERVED', 'ACTIVE'] } }
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

        const rental = await db.rental.create({
            data: {
                garmentId: garment.id,
                renterId: req.user.id,
                startDate: reqStart,
                endDate: reqEnd,
                totalPrice: amount,
                status: 'RESERVED',
                message: typeof message === 'string' && message.trim().length > 0 ? message.trim().slice(0, 2000) : null,
                shippingAddress: shippingAddress ? (typeof shippingAddress === 'string' ? JSON.parse(shippingAddress) : shippingAddress) : null,
                metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null,
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
            await createNotification({
                userId: garment.sellerId,
                type: 'RENTAL_RESERVED',
                title: 'New Rental Reservation',
                body: `${garment.title} has been reserved for ${days} days.`,
                data: { rentalId: rental.id, garmentId: garment.id },
            });
        } catch (notifErr) {
            logger.warn('Failed to send rental reserved notification', { error: notifErr });
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
        const { garmentId, days: daysInput } = req.body;
        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'garmentId is required' });
            return;
        }

        const days = Math.max(1, Math.min(30, Number(daysInput) || 3));

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
        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.renterId !== req.user.id && rental.garment.sellerId !== req.user.id) {
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
        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: true }
        });

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

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_RETURNED',
                title: 'Security Deposit Refunded',
                body: `Your security deposit for "${rental.garment.title}" has been released back to your account.`,
                data: { rentalId: rental.id, garmentId: rental.garmentId },
            });
        } catch (notifErr) {
            logger.warn('Failed to send deposit release notification', { error: notifErr });
        }

        const depositAmount = 299; // Flat refundable security deposit in pure Rupees

        res.json({
            data: {
                id: `escrow_${rental.id}`,
                rentalId: rental.id,
                amount: depositAmount,
                status: 'RELEASED',
                heldAt: rental.createdAt.toISOString(),
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

        const { getDownloadUrl } = await import('../lib/s3');
        const rentals = await Promise.all(
            rawRentals.map(async (rental: any) => {
                const userRole = rental.renterId === uid ? 'RENTER' : 'LENDER';
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
        const uid = req.user.id;

        const rental = await db.rental.findUnique({
            where: { id },
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

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        const isRenter = rental.renterId === uid;
        const isLender = rental.garment?.sellerId === uid;
        const isAdmin = (req.user as any).role === 'ADMIN';

        if (!isRenter && !isLender && !isAdmin) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to view this rental dossier' });
            return;
        }

        const userRole = isRenter ? 'RENTER' : 'LENDER';

        const { getDownloadUrl } = await import('../lib/s3');
        let resolvedImages = rental.garment?.images || [];
        if (Array.isArray(resolvedImages) && resolvedImages.length > 0) {
            resolvedImages = await Promise.all(resolvedImages.map((img: string) => getDownloadUrl(img)));
        }
        let renterAvatar = rental.renter?.avatar;
        if (renterAvatar) renterAvatar = await getDownloadUrl(renterAvatar);
        let lenderAvatar = rental.garment?.seller?.avatar;
        if (lenderAvatar) lenderAvatar = await getDownloadUrl(lenderAvatar);

        res.json({
            data: {
                ...rental,
                userRole,
                garment: rental.garment ? {
                    ...rental.garment,
                    images: resolvedImages,
                    seller: rental.garment.seller ? { ...rental.garment.seller, avatar: lenderAvatar } : undefined,
                } : null,
                renter: rental.renter ? { ...rental.renter, avatar: renterAvatar } : null,
            }
        });
    } catch (error) {
        logger.error('Failed to get rental by id', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch rental details' });
    }
}

export async function dispatchRental(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const { trackingNumber, carrier } = req.body || {};

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.garment.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only the garment lender can mark rental as dispatched' });
            return;
        }

        if (rental.status !== 'RESERVED') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot dispatch rental in status: ${rental.status}` });
            return;
        }

        const updated = await db.rental.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                trackingNumber: trackingNumber || null,
                carrier: carrier || 'BlueDart',
            },
            include: { garment: true, renter: true }
        });

        try {
            await createNotification({
                userId: rental.renterId,
                type: 'RENTAL_ACTIVE',
                title: '🚚 Rental Dispatched / Active',
                body: `"${rental.garment.title}" has been marked as dispatched by the lender (${carrier || 'BlueDart'}). Your rental period is active!`,
                data: { rentalId: id, trackingNumber, carrier },
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

export async function returnRental(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const { returnTracking, returnCarrier } = req.body || {};

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        if (rental.renterId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to return this rental' });
            return;
        }

        const updated = await db.rental.update({
            where: { id },
            data: {
                status: 'RETURNED',
                returnTracking: returnTracking || null,
                returnCarrier: returnCarrier || 'Delhivery',
            },
            include: { garment: true }
        });

        if (updated?.garment) {
            try {
                await createNotification({
                    userId: updated.garment.sellerId,
                    type: 'RENTAL_RETURNED',
                    title: 'Rental Item Returned',
                    body: `"${updated.garment.title}" has been dispatched back by renter (${returnCarrier || 'Delhivery'}). Please inspect upon delivery to release deposit.`,
                    data: { rentalId: id, returnTracking, returnCarrier },
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

export async function postRentalReview(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { id } = req.params;
        const { rating, comment } = req.body;
        const numRating = Number(rating);

        if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Rating must be an integer 1–5' });
            return;
        }

        const rental = await db.rental.findUnique({
            where: { id },
            include: { garment: true, renter: true }
        });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Rental not found' });
            return;
        }

        if (rental.renterId !== req.user.id && rental.garment?.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to review this rental' });
            return;
        }

        const isRenter = rental.renterId === req.user.id;
        const targetUserId = isRenter ? rental.garment.sellerId : rental.renterId;

        // Save peer review record if renter is reviewing lender/seller
        let review = null;
        if (isRenter) {
            review = await db.peerReview.create({
                data: {
                    reviewerId: req.user.id,
                    sellerId: targetUserId,
                    rating: numRating,
                    comment: typeof comment === 'string' ? comment.trim().slice(0, 2000) : null,
                }
            }).catch(() => null);
        }

        // Send Notification to reviewed party
        try {
            await createNotification({
                userId: targetUserId,
                type: 'PEER_REVIEW',
                title: '⭐️ New Rental Review!',
                body: `${req.user.displayName || 'Your rental partner'} left you a ${numRating}-star review for "${rental.garment?.title || 'the rental asset'}".`,
                data: { rentalId: id, rating: numRating, userId: targetUserId }
            });
        } catch (notifErr) {
            logger.warn('Failed to send rental review notification', { error: notifErr });
        }

        res.status(201).json({ success: true, data: review || { rating: numRating, comment } });
    } catch (error: any) {
        logger.error('postRentalReview failed', { error: error.message });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to submit review' });
    }
}


import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createNotification } from '../services/notification.service';

export async function getAvailableRentals(req: Request, res: Response): Promise<void> {
    try {
        const { category, startDate, endDate, priceMax } = req.query;

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
            query.rentalPriceDay = { lte: Math.round(Number(priceMax) * 100) };
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
                    }
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
                    createdAt: true,
                    seller: { select: { id: true, displayName: true, avatar: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            garments = garments.map((g: any) => ({ ...g, isLastPiece: true }));
        }

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

        const { garmentId, startDate, endDate, message } = req.body;

        if (!garmentId || !startDate || !endDate) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing required rental parameters' });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);

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

        const dayRate = garment.rentalPriceDay || 0;
        const weekRate = garment.rentalPriceWeek || 0;

        let amount: number;
        if (days >= 7 && weekRate > 0) {
            const weeks = Math.floor(days / 7);
            const remainderDays = days % 7;
            amount = weeks * weekRate + remainderDays * dayRate;
        } else {
            amount = dayRate * days;
        }

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
                data: { rentalId: rental.id },
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

        // Normalize rates to Rupees if stored in paise (e.g. 15000 paise -> 150 INR)
        const dailyRateInRupees = rawDayRate > 2000 ? Math.round(rawDayRate / 100) : (rawDayRate || 149);
        const weekRateInRupees = rawWeekRate > 5000 ? Math.round(rawWeekRate / 100) : (rawWeekRate || dailyRateInRupees * 5);

        let rentalFeeInRupees: number;
        if (days >= 7 && weekRateInRupees > 0) {
            const weeks = Math.floor(days / 7);
            const remainderDays = days % 7;
            rentalFeeInRupees = weeks * weekRateInRupees + remainderDays * dailyRateInRupees;
        } else {
            rentalFeeInRupees = dailyRateInRupees * days;
        }

        // Amount in paise (1 INR = 100 paise)
        const rentalFee = rentalFeeInRupees * 100;
        const securityDeposit = 29900; // Flat minimal refundable deposit of ₹299 for thrifting
        const insuranceFee = 4900; // Flat ₹49 optional damage waiver
        const deliveryFee = 19900; // ₹199 standard insured delivery
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
                data: { rentalId: rental.id },
            });
        } catch (notifErr) {
            logger.warn('Failed to send deposit release notification', { error: notifErr });
        }

        const depositAmount = rental.totalPrice * 2 * 100;

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

        const rentals = await db.rental.findMany({
            where: { renterId: req.user.id },
            include: {
                garment: {
                    select: {
                        id: true, title: true, brand: true, images: true,
                        category: true, price: true, rentalPriceDay: true,
                        rentalPriceWeek: true, condition: true, listingType: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({ data: rentals });
    } catch (error) {
        logger.error('Failed to fetch rentals', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function returnRental(req: Request, res: Response): Promise<void> {
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
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        if (rental.renterId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to return this rental' });
            return;
        }

        const updated = await db.rental.update({
            where: { id },
            data: { status: 'RETURNED' },
            include: { garment: true }
        });

        if (updated?.garment) {
            try {
                await createNotification({
                    userId: updated.garment.sellerId,
                    type: 'RENTAL_RETURNED',
                    title: 'Rental Item Returned',
                    body: `"${updated.garment.title}" has been marked as returned by renter. Please inspect and release deposit.`,
                    data: { rentalId: id },
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

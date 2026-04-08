import { Request, Response } from 'express';
import db from '../lib/prisma';
import Stripe from 'stripe';
import { logger } from '../lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-04-10' as any
});

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

        let garments = await db.garment.findMany({
            where: query,
            include: {
                rentals: {
                    where: {
                        status: { in: ['RESERVED', 'ACTIVE'] }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // If dates are provided, filter out those that overlap
        if (startDate && endDate) {
            const reqStart = new Date(String(startDate));
            const reqEnd = new Date(String(endDate));

            garments = garments.filter((garment: any) => {
                const hasConflict = garment.rentals.some((rental: any) => {
                    const rStart = new Date(rental.startDate);
                    const rEnd = new Date(rental.endDate);
                    // Check for overlap
                    return (reqStart <= rEnd && reqEnd >= rStart);
                });
                return !hasConflict;
            });
        }

        // Map 'isLastPiece' mock logic (e.g. if we had inventory numbers, but we assume 1 unique piece per garment)
        const mappedGarments = garments.map((g: any) => ({
            ...g,
            isLastPiece: true, // Vintage/heritage garments are always 1-of-1
            // omit the raw nested rentals array from response if desired
            rentals: undefined
        }));

        res.json({ data: mappedGarments });
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

        const { garmentId, startDate, endDate, shippingAddress, message } = req.body;

        if (!garmentId || !startDate || !endDate) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing required rental parameters' });
            return;
        }

        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);
        const days = Math.ceil((reqEnd.getTime() - reqStart.getTime()) / (1000 * 3600 * 24));

        if (days <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid date range' });
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

        // Check for conflicts again
        const hasConflict = garment.rentals.some((rental: any) => {
            const rStart = new Date(rental.startDate);
            const rEnd = new Date(rental.endDate);
            return (reqStart <= rEnd && reqEnd >= rStart);
        });

        if (hasConflict) {
            res.status(400).json({ error: 'CONFLICT', message: 'Garment is already rented for these dates' });
            return;
        }

        const amount = (garment.rentalPriceDay || 0) * days;
        const stripeAmount = amount; // Already in cents

        if (stripeAmount <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid rental pricing' });
            return;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: 'usd',
            metadata: {
                garmentId: garment.id,
                renterId: req.user.id,
                type: 'RENTAL'
            }
        });

        const rental = await db.rental.create({
            data: {
                garmentId: garment.id,
                renterId: req.user.id,
                startDate: reqStart,
                endDate: reqEnd,
                totalPrice: amount,
                status: 'RESERVED',
                stripeId: paymentIntent.id,
                message: typeof message === 'string' && message.trim().length > 0 ? message.trim().slice(0, 2000) : null,
            }
        });

        res.status(201).json({
            data: {
                rentalId: rental.id,
                clientSecret: paymentIntent.client_secret
            }
        });
    } catch (error) {
        logger.error('Failed to create rental', { error });
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
            include: { garment: true },
            orderBy: { createdAt: 'desc' }
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

        const rental = await db.rental.findUnique({ where: { id } });

        if (!rental) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        // Technically, a cron job or webhook would verify physical return, but we simulate it via PATCH
        const updated = await db.rental.update({
            where: { id },
            data: { status: 'RETURNED' }
        });

        res.json({ data: updated });
    } catch (error) {
        logger.error('Failed to mark rental returned', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

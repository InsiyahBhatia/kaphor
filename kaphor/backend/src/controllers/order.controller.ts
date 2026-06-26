import { Request, Response } from 'express';
import db from '../lib/prisma';
import Stripe from 'stripe';
import { logger } from '../lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-04-10' as any // Use a generic string or keep it strictly to typed API version constraints if applicable
});

/**
 * Opens (or reuses) a PENDING order so buyer and seller can message before payment.
 */
export async function createInquiryOrder(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        const { garmentId } = req.body;
        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing garmentId' });
            return;
        }

        const garment = await db.garment.findUnique({
            where: { id: String(garmentId) },
        });

        if (!garment || !garment.isActive || garment.lifecycleState === 'OWNERSHIP') {
            res.status(400).json({ error: 'UNAVAILABLE', message: 'Garment is no longer available' });
            return;
        }

        if (garment.sellerId === req.user.id) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot message yourself' });
            return;
        }

        const amount = garment.price || 0;
        if (amount <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid amount configured for this garment' });
            return;
        }

        const existing = await db.order.findFirst({
            where: {
                buyerId: req.user.id,
                sellerId: garment.sellerId,
                status: 'PENDING',
                items: { some: { garmentId: garment.id } },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existing) {
            res.status(200).json({ data: { orderId: existing.id, existing: true } });
            return;
        }

        const order = await db.order.create({
            data: {
                buyerId: req.user.id,
                sellerId: garment.sellerId,
                totalAmount: amount,
                status: 'PENDING',
                items: {
                    create: {
                        garmentId: garment.id,
                        price: amount,
                        quantity: 1,
                    },
                },
            },
        });

        // Transition garment to PURCHASE_INTENT
        await db.garment.update({
            where: { id: garment.id },
            data: { lifecycleState: 'PURCHASE_INTENT' }
        });

        res.status(201).json({ data: { orderId: order.id, existing: false } });
    } catch (error) {
        logger.error('createInquiryOrder failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to open conversation' });
    }
}

export async function createPaymentIntent(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        const { garmentId } = req.body;

        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing garmentId' });
            return;
        }

        const garment = await db.garment.findUnique({
            where: { id: String(garmentId) }
        });

        if (!garment || !garment.isActive || garment.lifecycleState === 'OWNERSHIP') {
            res.status(400).json({ error: 'UNAVAILABLE', message: 'Garment is no longer available' });
            return;
        }

        if (garment.sellerId === req.user.id) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot purchase your own garment' });
            return;
        }

        // Amount is already in cents in the DB
        const amount = garment.price || 0;

        if (amount <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid amount configured for this garment' });
            return;
        }

        let order = await db.order.findFirst({
            where: {
                buyerId: req.user.id,
                sellerId: garment.sellerId,
                status: 'PENDING',
                items: { some: { garmentId: garment.id } },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!order) {
            order = await db.order.create({
                data: {
                    buyerId: req.user.id,
                    sellerId: garment.sellerId,
                    totalAmount: garment.price || 0,
                    status: 'PENDING',
                    items: {
                        create: {
                            garmentId: garment.id,
                            price: garment.price || 0,
                            quantity: 1,
                        },
                    },
                },
            });

            // Transition garment to PURCHASE_INTENT
            await db.garment.update({
                where: { id: garment.id },
                data: { lifecycleState: 'PURCHASE_INTENT' }
            });
        }

        if (order.stripePaymentId) {
            try {
                const existingPi = await stripe.paymentIntents.retrieve(order.stripePaymentId);
                if (
                    existingPi.status === 'requires_payment_method' ||
                    existingPi.status === 'requires_confirmation' ||
                    existingPi.status === 'requires_action'
                ) {
                    res.status(200).json({
                        data: {
                            clientSecret: existingPi.client_secret,
                            orderId: order.id,
                        },
                    });
                    return;
                }
            } catch {
                // fall through and create a new payment intent
            }
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'inr',
            metadata: {
                orderId: order.id,
                garmentId: garment.id,
                buyerId: req.user.id,
                sellerId: garment.sellerId,
            },
        });

        await db.order.update({
            where: { id: order.id },
            data: { stripePaymentId: paymentIntent.id, totalAmount: garment.price || 0 },
        });

        res.status(200).json({
            data: {
                clientSecret: paymentIntent.client_secret,
                orderId: order.id,
            },
        });
    } catch (error) {
        logger.error('Failed to create payment intent', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to initialize payment' });
    }
}

export async function createCartOrder(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { garmentIds } = req.body; // Optional list of IDs to checkout

        const whereClause: any = { userId: req.user.id };
        if (Array.isArray(garmentIds) && garmentIds.length > 0) {
            whereClause.garmentId = { in: garmentIds };
        }

        const cartItems = await db.cartItem.findMany({
            where: whereClause,
            include: { garment: true }
        });

        if (cartItems.length === 0) {
            res.status(400).json({ error: 'EMPTY_CART', message: 'Your cart is empty' });
            return;
        }

        const validItems = cartItems.filter((i: any) => i.garment && i.garment.isActive);
        if (validItems.length === 0) {
            res.status(400).json({ error: 'INVALID_CART', message: 'Items in your cart are no longer available' });
            return;
        }

        // Calculate total
        const totalAmount = validItems.reduce((sum: number, item: any) => sum + (item.garment?.price || 0), 0);

        // For simplicity, we use the first seller as the main seller for the order object, 
        // but in a complex app we'd split orders per seller.
        const sellerId = validItems[0].garment!.sellerId;

        const order = await db.order.create({
            data: {
                buyerId: req.user.id,
                sellerId,
                totalAmount,
                status: 'PENDING',
                items: {
                    create: validItems.map((item: any) => ({
                        garmentId: item.garmentId,
                        price: item.garment!.price || 0,
                        quantity: 1,
                    }))
                }
            },
            include: {
                items: {
                    include: { garment: true }
                }
            }
        });

        // Optionally clear cart after order creation (or wait for payment)
        // For this demo, let's keep it until payment is confirmed or just clear it now to show progress
        // await db.cartItem.deleteMany({ where: { userId: req.user.id } });

        // Transition garments to PURCHASE_INTENT
        for (const item of validItems) {
            await db.garment.update({
                where: { id: item.garmentId },
                data: { lifecycleState: 'PURCHASE_INTENT' }
            });
        }

        res.status(201).json({ data: order });
    } catch (error) {
        logger.error('createCartOrder failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}


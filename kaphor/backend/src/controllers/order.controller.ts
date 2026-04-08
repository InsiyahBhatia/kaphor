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
            amount,
            currency: 'usd',
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


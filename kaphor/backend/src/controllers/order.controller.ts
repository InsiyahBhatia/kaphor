import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createRazorpayOrder, calculateDeliveryFee } from '../services/payment.service';

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

        if (!garment || !garment.isActive || garment.lifecycleState === 'OWNERSHIP' || garment.lifecycleState === 'RESERVED_SALE' || garment.reservedOrderId) {
            res.status(400).json({ error: 'UNAVAILABLE', message: 'Garment is no longer available' });
            return;
        }

        if (garment.sellerId === req.user.id) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot message yourself' });
            return;
        }

        const itemPrice = garment.price || 0;
        if (itemPrice <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid amount configured for this garment' });
            return;
        }

        const deliveryFee = calculateDeliveryFee(itemPrice);
        const totalAmount = itemPrice + deliveryFee;

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
                totalAmount,
                currency: 'INR',
                status: 'PENDING',
                items: {
                    create: {
                        garmentId: garment.id,
                        price: itemPrice,
                        quantity: 1,
                    },
                },
            },
        });

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

        if (!garment || !garment.isActive || garment.lifecycleState === 'OWNERSHIP' || garment.lifecycleState === 'RESERVED_SALE' || garment.reservedOrderId) {
            res.status(400).json({ error: 'UNAVAILABLE', message: 'Garment is no longer available' });
            return;
        }

        if (garment.sellerId === req.user.id) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot purchase your own garment' });
            return;
        }

        const itemPrice = garment.price || 0;
        if (itemPrice <= 0) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid amount configured for this garment' });
            return;
        }

        const deliveryFee = calculateDeliveryFee(itemPrice);
        const totalAmount = itemPrice + deliveryFee;

        // Find or create a pending order for this garment
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
                    totalAmount,
                    currency: 'INR',
                    status: 'PENDING',
                    items: {
                        create: {
                            garmentId: garment.id,
                            price: itemPrice,
                            quantity: 1,
                        },
                    },
                },
            });

            await db.garment.update({
                where: { id: garment.id },
                data: { lifecycleState: 'PURCHASE_INTENT' }
            });
        }

        // Create Razorpay order for total amount including delivery
        const rpOrder = await createRazorpayOrder(totalAmount, 'INR', order.id, {
            orderId: order.id,
            garmentId: garment.id,
        });

        await db.order.update({
            where: { id: order.id },
            data: { razorpayOrderId: rpOrder.id, totalAmount, currency: 'INR' },
        });

        res.status(200).json({
            data: {
                razorpayOrderId: rpOrder.id,
                orderId: order.id,
                amount: totalAmount,
                subtotal: itemPrice,
                deliveryFee,
                currency: 'INR',
            },
        });
    } catch (error) {
        logger.error('Failed to create Razorpay payment', { error: error instanceof Error ? error.message : String(error) });
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

        const validItems = cartItems.filter((i: any) => i.garment && i.garment.isActive && i.garment.lifecycleState !== 'OWNERSHIP' && i.garment.lifecycleState !== 'RESERVED_SALE' && !i.garment.reservedOrderId);
        if (validItems.length === 0) {
            res.status(400).json({ error: 'INVALID_CART', message: 'Items in your cart are no longer available' });
            return;
        }

        // Calculate items subtotal and delivery fee
        const itemsSubtotal = validItems.reduce((sum: number, item: any) => sum + (item.garment?.price || 0), 0);
        const deliveryFee = calculateDeliveryFee(itemsSubtotal);
        const totalAmount = itemsSubtotal + deliveryFee;

        // For simplicity, use first seller
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

        // Transition garments to PURCHASE_INTENT
        const garmentIdsToUpdate = validItems.map((item: any) => item.garmentId);
        if (garmentIdsToUpdate.length > 0) {
            await db.garment.updateMany({
                where: { id: { in: garmentIdsToUpdate } },
                data: { lifecycleState: 'PURCHASE_INTENT' }
            });
        }

        // Create a Razorpay order for immediate payment readiness
        let razorpayOrderId: string | null = null;
        try {
            const rpOrder = await createRazorpayOrder(totalAmount, 'INR', order.id, {
                orderId: order.id,
                type: 'CART',
            });
            razorpayOrderId = rpOrder.id;
            await db.order.update({
                where: { id: order.id },
                data: { razorpayOrderId: rpOrder.id, currency: 'INR' },
            });
        } catch (rpErr) {
            logger.warn('Failed to pre-create Razorpay order for cart', { error: rpErr instanceof Error ? rpErr.message : String(rpErr) });
        }

        res.status(201).json({
            data: {
                id: order.id,
                razorpayOrderId,
                totalAmount,
                subtotal: itemsSubtotal,
                deliveryFee,
                currency: 'INR',
                items: order.items,
            },
        });
    } catch (error) {
        logger.error('createCartOrder failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

/**
 * GET /orders/:orderId/payment
 * Get payment breakdown and transaction status for a specific order.
 */
export async function getOrderPaymentDetails(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { orderId } = req.params;
        const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { garment: true } } },
        });

        if (!order) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
            return;
        }

        if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
            return;
        }

        const statusMap: Record<string, string> = {
            PENDING: 'PENDING',
            CONFIRMED: 'PAID',
            SHIPPED: 'PAID',
            DELIVERED: 'PAID',
            REFUNDED: 'REFUNDED',
            CANCELLED: 'FAILED',
        };

        res.json({
            data: {
                id: order.id,
                orderId: order.id,
                type: 'PURCHASE',
                amount: order.totalAmount, // in paise
                currency: order.currency || 'INR',
                status: statusMap[order.status] || order.status,
                razorpayOrderId: order.razorpayOrderId || '',
                razorpayPaymentId: order.razorpayPaymentId || undefined,
                createdAt: order.createdAt.toISOString(),
                paidAt: order.status !== 'PENDING' ? order.updatedAt.toISOString() : undefined,
                refundedAt: order.status === 'REFUNDED' ? order.updatedAt.toISOString() : undefined,
            },
        });
    } catch (error) {
        logger.error('getOrderPaymentDetails failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}



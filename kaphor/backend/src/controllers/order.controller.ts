import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createRazorpayOrder, calculateDeliveryFee } from '../services/payment.service';
import { emitToUser, emitToConversation } from '../lib/socket';
import { createNotification } from '../services/notification.service';
import { cacheClear } from '../lib/cache';

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
            data: { 
                lifecycleState: 'PURCHASE_INTENT',
                reservedOrderId: order.id,
            }
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

        let isApproved = false;
        if (!order) {
            order = await db.order.create({
                data: {
                    buyerId: req.user.id,
                    sellerId: garment.sellerId,
                    totalAmount,
                    currency: 'INR',
                    status: 'PENDING',
                    notes: JSON.stringify({ approvalStatus: 'REQUESTED' }),
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
                data: { lifecycleState: 'PURCHASE_INTENT', reservedOrderId: order.id }
            });

            // Isolate dedicated conversation thread for this purchase transaction
            try {
                let conv = await db.conversation.findFirst({
                    where: { orderId: order.id },
                });
                if (!conv) {
                    conv = await db.conversation.create({
                        data: {
                            participant1Id: req.user.id,
                            participant2Id: garment.sellerId,
                            garmentId: garment.id,
                            orderId: order.id,
                            type: 'SALE',
                        },
                    });
                }
                const purchaseText = `🛍️ [PURCHASE REQUEST] Initiated a purchase request for "${garment.title}".\n• Amount: ₹${totalAmount.toLocaleString('en-IN')}\n• Order ID: ${order.id}\n• Status: Awaiting Seller Approval`;
                const chatMsg = await db.directMessage.create({
                    data: {
                        conversationId: conv.id,
                        senderId: req.user.id,
                        recipientId: garment.sellerId,
                        content: purchaseText,
                    },
                    include: {
                        sender: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
                    },
                });
                await db.conversation.update({
                    where: { id: conv.id },
                    data: {
                        lastMessageText: purchaseText.slice(0, 100),
                        lastMessageAt: new Date(),
                        orderId: order.id,
                        garmentId: garment.id,
                    },
                });
                emitToConversation(conv.id, 'direct_message', chatMsg);
                emitToUser(garment.sellerId, 'new_direct_message', { conversationId: conv.id, message: chatMsg });

                // Notify seller
                await createNotification({
                    userId: garment.sellerId,
                    type: 'ORDER_REQUESTED',
                    title: '🛍️ New Purchase Request!',
                    body: `${req.user.displayName || 'A buyer'} requested to buy "${garment.title}". Please review and approve.`,
                    data: { orderId: order.id, garmentId: garment.id, targetRoute: `/(tabs)/shop/orders/${order.id}` },
                });
                emitToUser(garment.sellerId, 'order:requested', { orderId: order.id, garmentId: garment.id });
            } catch (notifErr) {
                logger.warn('Failed to send order requested notification/message', { error: notifErr });
            }
        } else {
            // Check if existing order is approved
            try {
                const parsed = order.notes ? JSON.parse(order.notes) : null;
                isApproved = parsed?.approvalStatus === 'APPROVED' || Boolean(order.notes?.includes('APPROVED'));
            } catch {
                isApproved = Boolean(order.notes?.includes('APPROVED'));
            }
        }

        if (!isApproved) {
            res.status(200).json({
                data: {
                    orderId: order.id,
                    amount: totalAmount,
                    subtotal: itemPrice,
                    deliveryFee,
                    currency: 'INR',
                    approvalStatus: 'REQUESTED',
                    isApproved: false,
                    message: 'Purchase request submitted! Awaiting seller approval before payment.',
                },
            });
            return;
        }

        // Only generate Razorpay order if seller has approved
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
                approvalStatus: 'APPROVED',
                isApproved: true,
            },
        });
    } catch (error) {
        logger.error('Failed to create Razorpay payment', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to initialize payment' });
    }
}

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

/**
 * POST /orders/:orderId/approve
 * Seller approves buyer's purchase request, opening payment window.
 */
export async function approveOrderRequest(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const { orderId } = req.params;
        const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { garment: true } }, buyer: true },
        });
        if (!order) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
            return;
        }
        if (order.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only seller can approve this order' });
            return;
        }
        if (order.status !== 'PENDING') {
            res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot approve order with status ${order.status}` });
            return;
        }

        const updatedOrder = await db.order.update({
            where: { id: orderId },
            data: {
                notes: JSON.stringify({ approvalStatus: 'APPROVED', approvedAt: new Date().toISOString() }),
            },
            include: { items: { include: { garment: true } } },
        });

        // Notify Buyer
        const firstGarmentTitle = order.items[0]?.garment?.title || 'Garment';
        try {
            await createNotification({
                userId: order.buyerId,
                type: 'ORDER_APPROVED',
                title: '✅ Purchase Request Approved!',
                body: `The seller approved your purchase of "${firstGarmentTitle}". Complete payment to lock your purchase!`,
                data: { orderId: order.id, targetRoute: `/(tabs)/shop/orders/${order.id}` },
            });
            emitToUser(order.buyerId, 'order:approved', { orderId: order.id });

            // Post into conversation
            let conv = await db.conversation.findFirst({
                where: { orderId: order.id },
            });
            if (!conv) {
                conv = await db.conversation.findFirst({
                    where: {
                        OR: [
                            { participant1Id: order.buyerId, participant2Id: order.sellerId },
                            { participant1Id: order.sellerId, participant2Id: order.buyerId },
                        ],
                    },
                });
            }
            if (conv) {
                const approveText = `✨ [PURCHASE APPROVED] I have approved your purchase request for "${firstGarmentTitle}"! You can now proceed to payment.\n• Order ID: ${order.id}`;
                const chatMsg = await db.directMessage.create({
                    data: {
                        conversationId: conv.id,
                        senderId: req.user.id,
                        recipientId: order.buyerId,
                        content: approveText,
                    },
                    include: {
                        sender: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
                    },
                });
                await db.conversation.update({
                    where: { id: conv.id },
                    data: {
                        lastMessageText: approveText.slice(0, 100),
                        lastMessageAt: new Date(),
                        orderId: order.id,
                    },
                });
                emitToConversation(conv.id, 'direct_message', chatMsg);
                emitToUser(order.buyerId, 'new_direct_message', { conversationId: conv.id, message: chatMsg });
            }
        } catch (notifErr) {
            logger.warn('Failed to send order approved notification/message', { error: notifErr });
        }

        res.json({ data: updatedOrder, message: 'Purchase request approved successfully' });
    } catch (error) {
        logger.error('approveOrderRequest failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

/**
 * POST /orders/:orderId/reject
 * Seller declines buyer's purchase request and releases garment back to LISTED.
 */
export async function rejectOrderRequest(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        const { orderId } = req.params;
        const { reason } = req.body;
        const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { garment: true } } },
        });
        if (!order) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
            return;
        }
        if (order.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Only seller can decline this order' });
            return;
        }

        await db.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                notes: JSON.stringify({ approvalStatus: 'REJECTED', reason: reason || 'Seller declined' }),
            },
        });

        // Release garment reservations back to LISTED
        const garmentIds = order.items.map((i: any) => i.garmentId);
        if (garmentIds.length > 0) {
            await db.garment.updateMany({
                where: { id: { in: garmentIds } },
                data: {
                    lifecycleState: 'LISTED',
                    reservedOrderId: null,
                    isActive: true,
                },
            });
        }
        cacheClear('feed:');

        // Notify Buyer
        const firstGarmentTitle = order.items[0]?.garment?.title || 'Garment';
        try {
            await createNotification({
                userId: order.buyerId,
                type: 'ORDER_DECLINED',
                title: '⚠️ Purchase Request Declined',
                body: `The seller declined your purchase request for "${firstGarmentTitle}"${reason ? `: "${reason}"` : '.'}`,
                data: { orderId: order.id, targetRoute: `/(tabs)/shop/orders/${order.id}` },
            });
            emitToUser(order.buyerId, 'order:rejected', { orderId: order.id });

            let conv = await db.conversation.findFirst({
                where: { orderId: order.id },
            });
            if (conv) {
                const declineText = `⚠️ [PURCHASE DECLINED] Purchase request for "${firstGarmentTitle}" could not be accommodated${reason ? `: "${reason}"` : '.'}`;
                const chatMsg = await db.directMessage.create({
                    data: {
                        conversationId: conv.id,
                        senderId: req.user.id,
                        recipientId: order.buyerId,
                        content: declineText,
                    },
                    include: {
                        sender: { select: { id: true, displayName: true, username: true, avatar: true, isVerified: true } },
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
                emitToUser(order.buyerId, 'new_direct_message', { conversationId: conv.id, message: chatMsg });
            }
        } catch (notifErr) {
            logger.warn('Failed to send order declined notification/message', { error: notifErr });
        }

        res.json({ message: 'Purchase request declined and garment relisted.' });
    } catch (error) {
        logger.error('rejectOrderRequest failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}



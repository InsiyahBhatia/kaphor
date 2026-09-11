import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createRazorpayOrderForOrder, calculateDeliveryFee } from '../services/payment.service';
import { createNotification } from '../services/notification.service';
import { updateImpactOnTransaction } from '../services/impact.service';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

function getRazorpayInstance(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are missing (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createRazorpayOrder(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { garmentId } = req.body as { garmentId?: string };
    if (!garmentId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'garmentId is required' });
      return;
    }

    const garment = await db.garment.findUnique({ where: { id: String(garmentId) } });
    if (!garment || !garment.isActive || garment.lifecycleState === 'OWNERSHIP') {
      res.status(400).json({ error: 'UNAVAILABLE', message: 'Garment is no longer available' });
      return;
    }
    if (garment.sellerId === req.user.id) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot purchase your own garment' });
      return;
    }

    const itemPrice = garment.price || 0;
    if (itemPrice <= 0) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid garment price configuration' });
      return;
    }

    const deliveryFee = calculateDeliveryFee(itemPrice);
    const totalAmount = itemPrice + deliveryFee;

    // Reuse existing pending order thread for this buyer + seller + garment.
    let order = await db.order.findFirst({
      where: {
        buyerId: req.user.id,
        sellerId: garment.sellerId,
        status: 'PENDING',
        items: { some: { garmentId: garment.id } },
      },
      include: { items: true },
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
    } else if (order.totalAmount !== totalAmount) {
      await db.order.update({
        where: { id: order.id },
        data: { totalAmount },
      });
      order.totalAmount = totalAmount;
    }

    const razorpay = getRazorpayInstance();

    const rpOrder = await razorpay.orders.create({
      amount: totalAmount, // already in paise including delivery
      currency: 'INR',
      receipt: order.id,
      notes: { orderId: order.id },
    });

    await db.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rpOrder.id, totalAmount, currency: 'INR' },
    });

    res.json({
      data: {
        orderId: order.id,
        razorpayOrderId: rpOrder.id,
        amount: totalAmount,
        subtotal: itemPrice,
        deliveryFee,
        currency: 'INR',
      },
    });
  } catch (e) {
    logger.error('createRazorpayOrder failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to initialize Razorpay order' });
  }
}

/**
 * Create a Razorpay order for an existing order (cart flow, direct checkout).
 */
export async function createRazorpayOrderForExistingOrder(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { orderId } = req.body as { orderId?: string };
    if (!orderId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'orderId is required' });
      return;
    }

    // Verify the user owns this order
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true },
    });
    if (!existingOrder) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }
    if (existingOrder.buyerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to pay for this order' });
      return;
    }

    const result = await createRazorpayOrderForOrder(orderId);

    res.json({ data: result });
  } catch (e: any) {
    const message = e?.message || 'Failed to create Razorpay order';
    logger.error('createRazorpayOrderForExistingOrder failed', { error: message });
    res.status(400).json({ error: 'BAD_REQUEST', message });
  }
}

/**
 * Create a Razorpay order for a rental reservation (rental fee + refundable deposit + delivery).
 */
export async function createRazorpayOrderForRental(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { rentalOrderId } = req.body as { rentalOrderId?: string };
    if (!rentalOrderId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'rentalOrderId is required' });
      return;
    }

    const rental = await db.rental.findUnique({
      where: { id: rentalOrderId },
      include: { garment: true },
    });

    if (!rental) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Rental reservation not found' });
      return;
    }

    if (rental.renterId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to pay for this rental' });
      return;
    }

    // rental.totalPrice is stored in paise (e.g., 45000 paise = ₹450)
    const rawTotalPrice = rental.totalPrice || 0;
    let rentalFee = rawTotalPrice > 2000 ? rawTotalPrice : rawTotalPrice * 100;
    // Guard against double multiplication
    if (rentalFee > 10000000) {
      rentalFee = Math.round(rentalFee / 100);
    }

    // Standard rental fees matching breakdown (in paise)
    const securityDeposit = 29900; // Flat ₹299 refundable security deposit
    const insuranceFee = 4900;     // Flat ₹49 damage waiver
    const deliveryFee = 19900;     // Flat ₹199 delivery fee
    const totalAmount = rentalFee + securityDeposit + insuranceFee + deliveryFee;

    const razorpay = getRazorpayInstance();
    const receipt = `rent_${rental.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
    const rpOrder = await razorpay.orders.create({
      amount: totalAmount,
      currency: 'INR',
      receipt,
      notes: {
        rentalId: rental.id,
        garmentId: rental.garmentId,
        renterId: rental.renterId,
        type: 'RENTAL',
      },
    });

    // Store Razorpay order ID in rental stripeId column for gateway tracking
    await db.rental.update({
      where: { id: rental.id },
      data: { stripeId: rpOrder.id },
    });

    res.json({
      data: {
        orderId: rental.id,
        rentalOrderId: rental.id,
        razorpayOrderId: rpOrder.id,
        amount: totalAmount,
        currency: 'INR',
        breakdown: {
          rentalFee,
          securityDeposit,
          insuranceFee,
          deliveryFee,
        },
      },
    });
  } catch (e: any) {
    const message = e?.message || 'Failed to create Razorpay rental order';
    logger.error('createRazorpayOrderForRental failed', { error: message, stack: e?.stack });
    res.status(500).json({ error: 'INTERNAL_ERROR', message });
  }
}

/**
 * Verify Razorpay payment signature for both regular garment orders and rental reservations.
 */
export async function verifyRazorpayPayment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      orderId?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature are required',
      });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Razorpay secret missing on server' });
      return;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid Razorpay signature' });
      return;
    }

    // 1. Check if this is a standard Order
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (order) {
      if (order.buyerId !== req.user.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not allowed to verify this order' });
        return;
      }

      if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Razorpay order mismatch' });
        return;
      }

      const updated = await db.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      // Transition garments to OWNERSHIP + transfer ownership (sellerId) to buyer + deactivate marketplace listing
      const orderItems = await db.orderItem.findMany({
        where: { orderId },
        include: { garment: true },
      });
      const purchasedGarmentIds = orderItems.map((item: any) => item.garmentId);

      if (purchasedGarmentIds.length > 0) {
        await db.garment.updateMany({
          where: { id: { in: purchasedGarmentIds } },
          data: {
            lifecycleState: 'OWNERSHIP',
            sellerId: req.user.id,
            isActive: false, // Item is now owned by buyer; in their digital closet
          },
        });
      }

      // Record Environmental Impact metrics (CO2, Water, Waste, Items Circulated)
      try {
        await updateImpactOnTransaction(orderId);
      } catch (impactErr) {
        logger.warn('Failed to calculate impact for transaction', { error: impactErr });
      }

      // Auto-clear purchased items from buyer's cart
      if (purchasedGarmentIds.length > 0) {
        try {
          await db.cartItem.deleteMany({
            where: {
              userId: req.user.id,
              garmentId: { in: purchasedGarmentIds },
            },
          });
        } catch (cartErr) {
          logger.warn('Failed to clear cart items after purchase', { error: cartErr });
        }
      }

      // Notify Seller
      try {
        const firstTitle = orderItems[0]?.garment?.title || 'item';
        await createNotification({
          userId: order.sellerId,
          type: 'ORDER_PAID',
          title: '💰 Item Sold!',
          body: `Your item "${firstTitle}" has been purchased! Please prepare for shipping.`,
          data: { orderId: order.id },
        });
      } catch (notifErr) {
        logger.warn('Failed to send order paid notification to seller', { error: notifErr });
      }

      res.json({ data: updated, isRental: false });
      return;
    }

    // 2. Check if this is a Rental reservation
    const rental = await db.rental.findUnique({
      where: { id: orderId },
      include: { garment: true },
    });

    if (rental) {
      if (rental.renterId !== req.user.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not allowed to verify this rental' });
        return;
      }

      if (rental.stripeId && rental.stripeId !== razorpay_order_id) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Razorpay order mismatch for rental' });
        return;
      }

      const updatedRental = await db.rental.update({
        where: { id: orderId },
        data: {
          status: 'ACTIVE',
          stripeId: razorpay_order_id,
        },
        include: { garment: true },
      });

      // Notify Owner
      try {
        await createNotification({
          userId: rental.garment.sellerId,
          type: 'RENTAL_RESERVED',
          title: '🎉 Rental Confirmed & Paid!',
          body: `"${rental.garment.title}" has been booked and paid for. Please prepare for dispatch.`,
          data: { rentalId: rental.id },
        });
      } catch (notifErr) {
        logger.warn('Failed to send rental confirmed notification to seller', { error: notifErr });
      }

      // Notify Renter
      try {
        await createNotification({
          userId: rental.renterId,
          type: 'RENTAL_RESERVED',
          title: '✅ Rental Booking Confirmed!',
          body: `Your rental booking for "${rental.garment.title}" has been confirmed.`,
          data: { rentalId: rental.id },
        });
      } catch (notifErr) {
        logger.warn('Failed to send rental confirmed notification to renter', { error: notifErr });
      }

      res.json({ data: updatedRental, isRental: true });
      return;
    }

    res.status(404).json({ error: 'NOT_FOUND', message: 'Order or rental not found' });
  } catch (e) {
    logger.error('verifyRazorpayPayment failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to verify payment' });
  }
}

/**
 * Razorpay webhook — receives automatic payment confirmations.
 * Uses signature verification (no Bearer token).
 */
export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing signature header' });
      return;
    }

    // Verify webhook signature
    if (WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (expected !== signature) {
        logger.warn('Razorpay webhook signature mismatch');
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid signature' });
        return;
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    logger.info('Razorpay webhook received', { event });

    if (event === 'payment.captured' || event === 'order.paid') {
      const razorpayOrderId = payload?.order?.entity?.id;
      const razorpayPaymentId = payload?.payment?.entity?.id;

      if (!razorpayOrderId) {
        res.status(200).json({ status: 'ignored' });
        return;
      }

      // 1. Check if matches a standard purchase order
      const order = await db.order.findFirst({
        where: { razorpayOrderId },
      });

      if (order) {
        if (order.status === 'CONFIRMED') {
          res.status(200).json({ status: 'already_confirmed' });
          return;
        }

        await db.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
          },
        });

        // Transition purchased garments to OWNERSHIP + transfer sellerId to buyer + deactivate
        const webhookItems = await db.orderItem.findMany({
          where: { orderId: order.id },
          include: { garment: true },
        });
        const webhookGarmentIds: string[] = [];
        for (const whItem of webhookItems) {
          if (whItem.garment) {
            webhookGarmentIds.push(whItem.garmentId);
            await db.garment.update({
              where: { id: whItem.garmentId },
              data: {
                lifecycleState: 'OWNERSHIP',
                sellerId: order.buyerId,
                isActive: false,
              },
            });
          }
        }

        // Record Environmental Impact metrics (CO2, Water, Waste, Items Circulated)
        try {
          await updateImpactOnTransaction(order.id);
        } catch (impactErr) {
          logger.warn('Failed to calculate impact for transaction in webhook', { error: impactErr });
        }

        if (webhookGarmentIds.length > 0) {
          try {
            await db.cartItem.deleteMany({
              where: {
                userId: order.buyerId,
                garmentId: { in: webhookGarmentIds },
              },
            });
          } catch (cartErr) {
            logger.warn('Webhook failed to clear cart items', { error: cartErr });
          }
        }

        try {
          const firstTitle = webhookItems[0]?.garment?.title || 'item';
          await createNotification({
            userId: order.sellerId,
            type: 'ORDER_PAID',
            title: '💰 Item Sold!',
            body: `Your item "${firstTitle}" has been purchased! Please prepare for shipping.`,
            data: { orderId: order.id },
          });
        } catch (notifErr) {
          logger.warn('Failed to notify seller in webhook', { error: notifErr });
        }

        logger.info('Order auto-confirmed via webhook', {
          orderId: order.id,
          razorpayOrderId,
          razorpayPaymentId,
        });

        res.status(200).json({ status: 'ok' });
        return;
      }

      // 2. Check if matches a rental reservation
      const rental = await db.rental.findFirst({
        where: { stripeId: razorpayOrderId },
        include: { garment: true },
      });

      if (rental) {
        if (rental.status === 'ACTIVE') {
          res.status(200).json({ status: 'already_active' });
          return;
        }

        await db.rental.update({
          where: { id: rental.id },
          data: { status: 'ACTIVE' },
        });

        try {
          await createNotification({
            userId: rental.garment.sellerId,
            type: 'RENTAL_RESERVED',
            title: '🎉 Rental Confirmed & Paid!',
            body: `"${rental.garment.title}" has been booked and paid for via webhook.`,
            data: { rentalId: rental.id },
          });
        } catch (notifErr) {
          logger.warn('Failed to notify seller in webhook', { error: notifErr });
        }

        logger.info('Rental auto-confirmed via webhook', {
          rentalId: rental.id,
          razorpayOrderId,
          razorpayPaymentId,
        });

        res.status(200).json({ status: 'ok' });
        return;
      }

      logger.warn('Webhook: neither order nor rental found for Razorpay order', { razorpayOrderId });
      res.status(200).json({ status: 'entity_not_found' });
      return;
    }

    res.status(200).json({ status: 'ok' });
  } catch (e) {
    logger.error('razorpayWebhook failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Webhook processing failed' });
  }
}

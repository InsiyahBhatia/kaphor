import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createRazorpayOrderForOrder, calculateDeliveryFee } from '../services/payment.service';
import { createNotification } from '../services/notification.service';
import { updateImpactOnTransaction } from '../services/impact.service';
import {
  claimGarmentsForOrder,
  transferGarmentsToBuyer,
  releaseGarmentReservations,
} from '../services/garment-claim.service';
import { cacheClear } from '../lib/cache';
import { safeEqual } from '../utils/jwt';

const PAID_RENTAL_STATUSES = ['RESERVED', 'DISPATCHED', 'ACTIVE', 'COMPLETED'];

function hmacHex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}


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
    if (
      !garment ||
      !garment.isActive ||
      garment.lifecycleState === 'OWNERSHIP' ||
      garment.lifecycleState === 'RESERVED_SALE'
    ) {
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

    if (order) {
      let isApproved = false;
      try {
        const parsed = order.notes ? JSON.parse(order.notes) : null;
        isApproved = parsed?.approvalStatus === 'APPROVED' || Boolean(order.notes?.includes('APPROVED'));
      } catch {
        isApproved = Boolean(order.notes?.includes('APPROVED'));
      }
      if (!isApproved) {
        res.status(400).json({
          error: 'APPROVAL_REQUIRED',
          message: 'Seller approval is required before payment can be generated.',
        });
        return;
      }
    }

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
    } else if (order.totalAmount !== totalAmount) {
      await db.order.update({
        where: { id: order.id },
        data: { totalAmount },
      });
      order.totalAmount = totalAmount;
    }

    const razorpay = getRazorpayInstance();

    const rpOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // convert to paise only for Razorpay API
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
 * Create a Razorpay order for an existing order (direct checkout).
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
    logger.error('createRazorpayOrderForExistingOrder failed', { error: e?.message });
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Could not create the payment. Please try again.' });
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
      include: { garment: { select: GARMENT_LIST_COLUMNS } },
    });

    if (!rental) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Rental reservation not found' });
      return;
    }

    if (rental.renterId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to pay for this rental' });
      return;
    }

    if (rental.paidAt || ['RESERVED', 'DISPATCHED', 'ACTIVE', 'COMPLETED'].includes(rental.status)) {
      res.status(400).json({ error: 'ALREADY_PAID', message: 'This rental has already been paid.' });
      return;
    }

    // rental.totalPrice is stored in pure whole Rupees (e.g. ₹450)
    const rentalFee = rental.totalPrice || 0;
    const securityDeposit = 299; // Flat ₹299 refundable security deposit
    // Insurance (₹49 damage waiver) is optional: the renter can untick it on the pay screen.
    const includeInsurance = (req.body as any)?.includeInsurance !== false;
    const insuranceFee = includeInsurance ? 49 : 0;
    const deliveryFee = 199;     // Flat ₹199 delivery fee
    const totalAmount = rentalFee + securityDeposit + insuranceFee + deliveryFee;

    const razorpay = getRazorpayInstance();
    const receipt = `rent_${rental.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // paise only for Razorpay API
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
    const prevMeta = (rental.metadata && typeof rental.metadata === 'object' && !Array.isArray(rental.metadata)) ? (rental.metadata as any) : {};
    await db.rental.update({
      where: { id: rental.id },
      data: {
        stripeId: rpOrder.id,
        metadata: {
          ...prevMeta,
          rentalFee,
          refundableDeposit: securityDeposit,
          damageInsurance: insuranceFee,
          deliveryReturnFee: deliveryFee,
          grandTotal: totalAmount,
          includeInsurance,
        } as any,
      },
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
    logger.error('createRazorpayOrderForRental failed', { error: e?.message, stack: e?.stack });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not create the rental payment. Please try again.' });
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

    if (
      [orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature].some(
        (v) => typeof v !== 'string' || v.length > 200
      )
    ) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid payment details' });
      return;
    }

    const expected = hmacHex(secret, `${razorpay_order_id}|${razorpay_payment_id}`);

    if (!safeEqual(expected, razorpay_signature)) {
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

      // The Razorpay order id must be the one WE created for this exact order (with the server-side
      // amount). Without this, someone could pay for a cheap order and "verify" an expensive one.
      if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Razorpay order mismatch' });
        return;
      }

      if (['REFUNDED', 'CANCELLED'].includes(String(order.status))) {
        res.status(409).json({ error: 'CONFLICT', message: 'This order can no longer be paid' });
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

      // Atomically reserve garments for this order
      const claimed = await claimGarmentsForOrder(orderId, order.buyerId);
      if (!claimed) {
        logger.error('Payment verified but garments could not be reserved (sold elsewhere)', {
          orderId,
          razorpayOrderId: razorpay_order_id,
        });
        // Full refund — the items are no longer available.
        try {
          const rp = getRazorpayInstance();
          await rp.payments.refund(razorpay_payment_id, {
            speed: 'normal',
            notes: { reason: 'ITEM_SOLD_ELSEWHERE', orderId },
          });
          await db.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
        } catch (refundErr) {
          logger.error('Auto-refund after failed reservation failed', { orderId, error: refundErr });
        }
        res.status(409).json({
          error: 'CONFLICT',
          message: 'Item(s) were just sold to another buyer. Your payment has been refunded.',
        });
        return;
      }

      // Immediately transfer garments to buyer so they appear in their wardrobe and are delisted
      await transferGarmentsToBuyer(orderId, order.buyerId);

      const orderItems = await db.orderItem.findMany({
        where: { orderId },
        include: { garment: { select: GARMENT_LIST_COLUMNS } },
      });
      const purchasedGarmentIds = orderItems.map((item: any) => item.garmentId);

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

      // Link conversation with this order so it appears under SELL/ORDER tab
      try {
        const firstGarmentId = purchasedGarmentIds[0] || null;
        let conv = await db.conversation.findFirst({
          where: {
            OR: [
              { participant1Id: order.buyerId, participant2Id: order.sellerId, garmentId: firstGarmentId },
              { participant1Id: order.sellerId, participant2Id: order.buyerId, garmentId: firstGarmentId },
              { participant1Id: order.buyerId, participant2Id: order.sellerId },
              { participant1Id: order.sellerId, participant2Id: order.buyerId },
            ],
          },
        });
        if (conv) {
          await db.conversation.update({
            where: { id: conv.id },
            data: { orderId: order.id, type: 'SALE' },
          });
        }
      } catch (convErr) {
        logger.warn('Failed to associate conversation with order', { error: convErr });
      }

      // Invalidate feed cache immediately
      cacheClear('feed:');

      res.json({ data: updated, isRental: false });
      return;
    }

    // 2. Check if this is a Rental reservation
    const rental = await db.rental.findUnique({
      where: { id: orderId },
      include: { garment: { select: GARMENT_LIST_COLUMNS } },
    });

    if (rental) {
      if (rental.renterId !== req.user.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not allowed to verify this rental' });
        return;
      }

      if (rental.paidAt || PAID_RENTAL_STATUSES.includes(rental.status)) {
        res.status(400).json({ error: 'ALREADY_PAID', message: 'This rental has already been paid and confirmed.' });
        return;
      }

      if (!rental.stripeId || rental.stripeId !== razorpay_order_id) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Razorpay order mismatch for rental' });
        return;
      }

      const currentHistory = Array.isArray(rental.trackingHistory) ? (rental.trackingHistory as any[]) : [];
      const updatedRental = await db.rental.update({
        where: { id: orderId },
        data: {
          status: 'RESERVED',
          paidAt: new Date(),
          stripeId: razorpay_order_id,
          trackingHistory: [
            ...currentHistory,
            { status: 'RESERVED', timestamp: new Date().toISOString(), note: 'Payment verified and held safely until delivery. Ready to pack and ship.' }
          ],
        },
        include: { garment: { select: GARMENT_LIST_COLUMNS } },
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

      // Link conversation with this rental so it appears under RENT tab
      try {
        let conv = await db.conversation.findFirst({
          where: {
            OR: [
              { participant1Id: rental.renterId, participant2Id: rental.garment.sellerId, garmentId: rental.garmentId },
              { participant1Id: rental.garment.sellerId, participant2Id: rental.renterId, garmentId: rental.garmentId },
              { participant1Id: rental.renterId, participant2Id: rental.garment.sellerId },
              { participant1Id: rental.garment.sellerId, participant2Id: rental.renterId },
            ],
          },
        });
        if (conv) {
          await db.conversation.update({
            where: { id: conv.id },
            data: { rentalId: rental.id, type: 'RENTAL' },
          });
        }
      } catch (convErr) {
        logger.warn('Failed to associate conversation with rental', { error: convErr });
      }

      // Invalidate feed cache immediately
      cacheClear('feed:');

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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Never accept unsigned webhooks.
      logger.error('RAZORPAY_WEBHOOK_SECRET is not set; rejecting webhook');
      res.status(503).json({ error: 'UNAVAILABLE' });
      return;
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody: Buffer | undefined = Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody : undefined;
    if (typeof signature !== 'string' || !rawBody) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing signature header' });
      return;
    }

    // Signature is computed over the exact bytes Razorpay sent (not re-serialised JSON).
    if (!safeEqual(hmacHex(webhookSecret, rawBody), signature)) {
      logger.warn('Razorpay webhook signature mismatch');
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid signature' });
      return;
    }

    let body: any;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid body' });
      return;
    }

    const event = body.event;
    const payload = body.payload;

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
        if (order.status !== 'PENDING') {
          // Already confirmed / shipped / refunded: Razorpay retries webhooks, so this must be a no-op.
          res.status(200).json({ status: 'already_processed' });
          return;
        }

        // Amount paid must match what we asked for (paise).
        const paidPaise = Number(payload?.payment?.entity?.amount ?? payload?.order?.entity?.amount_paid);
        if (Number.isFinite(paidPaise) && paidPaise !== Math.round(order.totalAmount * 100)) {
          logger.error('Webhook amount mismatch', {
            orderId: order.id,
            expected: Math.round(order.totalAmount * 100),
            paidPaise,
          });
          res.status(200).json({ status: 'amount_mismatch' });
          return;
        }

        await db.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
          },
        });

        // Atomically reserve garments for this order (idempotent — re-claiming
        // an order's own reservation is a no-op). Ownership transfers at delivery.
        const claimed = await claimGarmentsForOrder(order.id, order.buyerId);
        if (!claimed) {
          logger.error('Webhook: garments could not be reserved (sold elsewhere)', {
            orderId: order.id,
            razorpayOrderId,
          });
          try {
            const rp = getRazorpayInstance();
            if (razorpayPaymentId) {
              await rp.payments.refund(razorpayPaymentId, {
                speed: 'normal',
                notes: { reason: 'ITEM_SOLD_ELSEWHERE', orderId: order.id },
              });
            }
            await db.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
          } catch (refundErr) {
            logger.error('Webhook auto-refund after failed reservation failed', { orderId: order.id, error: refundErr });
          }
          res.status(200).json({ status: 'refunded_item_sold' });
          return;
        }

        const webhookItems = await db.orderItem.findMany({
          where: { orderId: order.id },
          include: { garment: { select: GARMENT_LIST_COLUMNS } },
        });

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
        include: { garment: { select: GARMENT_LIST_COLUMNS } },
      });

      if (rental) {
        if (rental.paidAt || PAID_RENTAL_STATUSES.includes(rental.status)) {
          res.status(200).json({ status: 'already_processed' });
          return;
        }

        // Same state the client-side verify step uses: paid and held in escrow until dispatch.
        await db.rental.update({
          where: { id: rental.id },
          data: { status: 'RESERVED', paidAt: new Date() },
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

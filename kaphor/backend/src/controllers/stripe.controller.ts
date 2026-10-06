import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { Request, Response } from 'express';
import stripe from '../lib/stripe';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { auditLog } from '../services/audit.service';
import { createNotification } from '../services/notification.service';
import { transferGarmentsToBuyer } from '../services/garment-claim.service';


export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!stripe || !WEBHOOK_SECRET) {
    logger.error('Stripe webhook received but Stripe is not configured');
    res.status(503).send('Webhook not configured');
    return;
  }
  if (!sig || typeof sig !== 'string' || !Buffer.isBuffer((req as any).rawBody)) {
    res.status(400).send('Webhook Error: Missing signature');
    return;
  }

  let event;

  try {
    // rawBody (the exact bytes Stripe signed) is attached in index.ts. Stripe's SDK does the
    // constant-time comparison and rejects events older than 5 minutes.
    event = stripe.webhooks.constructEvent((req as any).rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error('Webhook signature verification failed', { error: err.message });
    res.status(400).send('Webhook Error: invalid signature');
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as any;
      await handlePaymentSuccess(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      logger.warn('Payment failed', { id: (event.data.object as any).id });
      break;
    default:
      logger.info(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}

async function handlePaymentSuccess(paymentIntent: any) {
  const metaOrderId = paymentIntent.metadata?.orderId as string | undefined;

  try {
    if (metaOrderId) {
      const existing = await db.order.findUnique({ where: { id: metaOrderId } });
      if (!existing) {
        logger.warn('Stripe webhook for unknown order', { metaOrderId });
        return;
      }
      // Idempotency: Stripe retries events. Only a PENDING order can be confirmed.
      if (existing.status !== 'PENDING') {
        logger.info('Stripe webhook ignored (order already processed)', { metaOrderId });
        return;
      }
      // Amount check (Stripe uses the smallest currency unit; INR orders are stored in rupees).
      const expectedMinor = Math.round(existing.totalAmount * 100);
      if (typeof paymentIntent.amount_received === 'number' && paymentIntent.amount_received !== expectedMinor) {
        logger.error('Stripe amount mismatch', { metaOrderId, expectedMinor, got: paymentIntent.amount_received });
        return;
      }

      const updatedOrder = await db.order.update({
        where: { id: metaOrderId },
        data: {
          status: 'CONFIRMED',
          stripePaymentId: paymentIntent.id,
        },
        include: {
          items: { include: { garment: { select: GARMENT_LIST_COLUMNS } } },
        },
      });

      // Atomically transfer garments to buyer (OWNERSHIP, sellerId = buyerId, isActive = false)
      await transferGarmentsToBuyer(metaOrderId, updatedOrder.buyerId);

      // Notify Seller
      await createNotification({
        userId: updatedOrder.sellerId,
        type: 'ORDER_PAID',
        title: '💰 Item Sold!',
        body: `Your item "${updatedOrder.items[0]?.garment?.title}" has been purchased! Please prepare for shipping.`,
        data: { orderId: metaOrderId },
      });

      await auditLog({
        action: 'PAYMENT_SUCCESS',
        resource: 'Order',
        metadata: { orderId: metaOrderId, stripeId: paymentIntent.id },
      });
      logger.info('Order confirmed via webhook', { orderId: metaOrderId });
      return;
    }

    const byPi = await db.order.updateMany({
      where: { stripePaymentId: paymentIntent.id, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    if (byPi.count > 0) {
      logger.info('Order confirmed via webhook (matched payment intent id)', {
        stripeId: paymentIntent.id,
      });
    }
  } catch (error) {
    logger.error('Failed to update order after payment success', {
      error,
      metaOrderId,
      stripeId: paymentIntent.id,
    });
  }
}

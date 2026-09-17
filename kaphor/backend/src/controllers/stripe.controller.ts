import { Request, Response } from 'express';
import stripe from '../lib/stripe';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { auditLog } from '../services/audit.service';
import { createNotification } from '../services/notification.service';
import { transferGarmentsToBuyer } from '../services/garment-claim.service';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];

  if (!sig || !WEBHOOK_SECRET) {
    res.status(400).send('Webhook Error: Missing signature or secret');
    return;
  }

  let event;

  try {
    // We use req.rawBody which was attached in index.ts
    event = stripe.webhooks.constructEvent((req as any).rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error('Webhook signature verification failed', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
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
      const updatedOrder = await db.order.update({
        where: { id: metaOrderId },
        data: {
          status: 'CONFIRMED',
          stripePaymentId: paymentIntent.id,
        },
        include: {
          items: { include: { garment: true } },
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
      where: { stripePaymentId: paymentIntent.id },
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

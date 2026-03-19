import { Request, Response } from 'express';
import stripe from '../lib/stripe';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { auditLog } from '../services/audit.service';

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
  const orderId = paymentIntent.metadata.orderId;
  if (!orderId) return;

  try {
    await db.order.update({
      where: { id: orderId },
      data: { 
        status: 'CONFIRMED',
        stripePaymentId: paymentIntent.id
      },
    });
    
    await auditLog({ 
      action: 'PAYMENT_SUCCESS', 
      resource: 'Order', 
      metadata: { orderId, stripeId: paymentIntent.id } 
    });
    
    logger.info('Order confirmed via webhook', { orderId });
  } catch (error) {
    logger.error('Failed to update order after payment success', { error, orderId });
  }
}

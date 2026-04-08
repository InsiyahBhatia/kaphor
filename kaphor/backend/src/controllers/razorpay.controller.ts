import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import Razorpay from 'razorpay';
import crypto from 'crypto';

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

    if (!garment.price || garment.price <= 0) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid garment price configuration' });
      return;
    }

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
          totalAmount: garment.price,
          currency: 'INR',
          status: 'PENDING',
          items: {
            create: {
              garmentId: garment.id,
              price: garment.price,
              quantity: 1,
            },
          },
        },
      });
    }

    const razorpay = getRazorpayInstance();

    const rpOrder = await razorpay.orders.create({
      amount: order.totalAmount, // already in paise
      currency: 'INR',
      receipt: order.id,
      notes: { orderId: order.id },
    });

    await db.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rpOrder.id, currency: 'INR' },
    });

    res.json({
      data: {
        orderId: order.id,
        razorpayOrderId: rpOrder.id,
        amount: order.totalAmount,
        currency: 'INR',
      },
    });
  } catch (e) {
    logger.error('createRazorpayOrder failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to initialize Razorpay order' });
  }
}

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

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

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

    res.json({ data: updated });
  } catch (e) {
    logger.error('verifyRazorpayPayment failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to verify payment' });
  }
}


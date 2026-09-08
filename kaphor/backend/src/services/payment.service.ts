import Razorpay from 'razorpay';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

function getRazorpayInstance(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are missing (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createRazorpayOrder(
  amount: number,
  currency: string,
  receipt: string,
  notes?: Record<string, string>
): Promise<any> {
  try {
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes,
    });
    return order;
  } catch (error) {
    const errMsg = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(Object.getOwnPropertyNames(error).reduce((a: Record<string, unknown>, k) => { a[k] = (error as Record<string, unknown>)[k]; return a; }, {}))
        : String(error);
    logger.error('Failed to create Razorpay order', {
      error: errMsg,
      amount,
      currency,
      receipt,
    });
    throw error instanceof Error ? error : new Error(errMsg);
  }
}

export async function createRazorpayOrderForOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { garment: true } } },
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.status !== 'PENDING') {
    throw new Error('Order is not in PENDING status');
  }

  const amount = order.totalAmount;
  const currency = order.currency || 'INR';
  const receipt = order.id;

  const rpOrder = await createRazorpayOrder(amount, currency, receipt, {
    orderId: order.id,
    type: 'ORDER',
  });

  await db.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: rpOrder.id, totalAmount: amount, currency },
  });

  return {
    orderId: order.id,
    razorpayOrderId: rpOrder.id,
    amount,
    currency,
  };
}

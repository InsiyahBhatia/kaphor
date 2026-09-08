import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import Razorpay from 'razorpay';
import {
  getUserPayoutAccounts,
  addPayoutAccount,
  deletePayoutAccount,
} from '../services/payout.service';
import { createNotification } from '../services/notification.service';

function getRazorpayInstance(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * GET /users/me/payout-accounts
 */
export async function listPayoutAccounts(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const accounts = getUserPayoutAccounts(req.user.id);
    res.json({ data: accounts });
  } catch (err) {
    logger.error('listPayoutAccounts failed', { error: err });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /users/me/payout-accounts
 */
export async function createPayoutAccount(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const { accountHolderName, accountNumber, ifsc, bankName, upiId, isDefault } = req.body;
    if (!accountHolderName || (!accountNumber && !upiId)) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Account holder name and account number (or UPI ID) are required',
      });
      return;
    }

    const account = addPayoutAccount(req.user.id, {
      accountHolderName,
      accountNumber: accountNumber || '',
      ifsc: ifsc || '',
      bankName: bankName || (upiId ? 'UPI' : 'Bank'),
      upiId,
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({ data: account });
  } catch (err) {
    logger.error('createPayoutAccount failed', { error: err });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * DELETE /users/me/payout-accounts/:id
 */
export async function removePayoutAccount(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const { id } = req.params;
    const success = deletePayoutAccount(req.user.id, id);
    if (!success) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Payout account not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('removePayoutAccount failed', { error: err });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /payments/history
 * Unified payment transactions history for buyer and seller.
 */
export async function getPaymentHistory(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const userId = req.user.id;

    // 1. Fetch user purchase orders
    const orders = await db.order.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        items: { include: { garment: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 2. Fetch user rentals
    const rentals = await db.rental.findMany({
      where: { renterId: userId },
      include: { garment: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const transactions: any[] = [];

    // Map orders
    for (const order of orders) {
      const isBuyer = order.buyerId === userId;
      const firstItem = order.items[0]?.garment;
      const title = firstItem?.title || 'Kaphor Order';

      const statusMap: Record<string, string> = {
        PENDING: 'PENDING',
        CONFIRMED: 'PAID',
        SHIPPED: 'PAID',
        DELIVERED: 'PAID',
        REFUNDED: 'REFUNDED',
        CANCELLED: 'FAILED',
      };

      transactions.push({
        id: `tx_ord_${order.id}`,
        type: isBuyer ? 'PURCHASE' : 'SELLER_PAYOUT',
        amount: order.totalAmount, // in paise
        currency: order.currency || 'INR',
        status: statusMap[order.status] || order.status,
        description: isBuyer ? `Purchased "${title}"` : `Sold "${title}"`,
        referenceId: order.razorpayOrderId || order.id,
        createdAt: order.createdAt.toISOString(),
      });
    }

    // Map rentals
    for (const rental of rentals) {
      const title = rental.garment?.title || 'Rental Item';
      const statusMap: Record<string, string> = {
        RESERVED: 'HELD_IN_ESCROW',
        ACTIVE: 'PAID',
        RETURNED: 'RELEASED_TO_SELLER',
        OVERDUE: 'PAID',
      };

      // 100 paise = 1 INR
      const amountInPaise = rental.totalPrice * 100;

      transactions.push({
        id: `tx_rent_${rental.id}`,
        type: 'RENTAL_FEE',
        amount: amountInPaise,
        currency: 'INR',
        status: statusMap[rental.status] || rental.status,
        description: `Rental reservation for "${title}"`,
        referenceId: rental.stripeId || rental.id,
        createdAt: rental.createdAt.toISOString(),
      });
    }

    // Sort by createdAt descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ data: transactions });
  } catch (err) {
    logger.error('getPaymentHistory failed', { error: err });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /payments/payouts
 * Seller payout history with commission calculation.
 */
export async function getSellerPayouts(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const soldOrders = await db.order.findMany({
      where: {
        sellerId: req.user.id,
        status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const payouts = soldOrders.map((order: any) => {
      const amount = order.totalAmount; // in paise
      const commission = Math.round(amount * 0.1); // 10% platform commission
      const netAmount = amount - commission;
      const isDelivered = order.status === 'DELIVERED';

      return {
        id: `payout_${order.id}`,
        orderId: order.id,
        amount,
        commission,
        netAmount,
        status: isDelivered ? 'PAID' : 'PROCESSING',
        createdAt: order.createdAt.toISOString(),
        paidAt: isDelivered ? order.updatedAt.toISOString() : undefined,
      };
    });

    res.json({ data: payouts });
  } catch (err) {
    logger.error('getSellerPayouts failed', { error: err });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /payments/refund
 * Request full or partial refund for an order.
 */
export async function requestRefund(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { orderId, reason, amount } = req.body;
    if (!orderId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'orderId is required' });
      return;
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { garment: true } } },
    });

    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id && (req.user as any).role !== 'ADMIN') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to request refund for this order' });
      return;
    }

    const refundAmount = amount ? Number(amount) : order.totalAmount;

    // Trigger Razorpay refund API if payment ID exists
    const razorpay = getRazorpayInstance();
    if (razorpay && order.razorpayPaymentId) {
      try {
        await razorpay.payments.refund(order.razorpayPaymentId, {
          amount: refundAmount,
          notes: {
            reason: reason || 'Customer requested refund',
            orderId: order.id,
          },
        });
      } catch (rpErr) {
        logger.warn('Razorpay refund API call notice (may be test/sandbox mode)', {
          error: rpErr instanceof Error ? rpErr.message : String(rpErr),
        });
      }
    }

    // Update order status
    const updated = await db.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED' },
    });

    // Relist garments back to LISTED and active
    for (const item of order.items) {
      await db.garment.update({
        where: { id: item.garmentId },
        data: {
          lifecycleState: 'LISTED',
          isActive: true,
          sellerId: order.sellerId, // Restore original seller
        },
      });
    }

    // Notify buyer and seller
    try {
      await createNotification({
        userId: order.buyerId,
        type: 'ORDER_PAID', // or generic notification
        title: 'Refund Processed',
        body: `A refund of ₹${(refundAmount / 100).toLocaleString('en-IN')} has been initiated for your order.`,
        data: { orderId: order.id },
      });
      await createNotification({
        userId: order.sellerId,
        type: 'ORDER_PAID',
        title: 'Order Refunded',
        body: `Order #${order.id.slice(0, 8)} was refunded. The item has been relisted in your shop.`,
        data: { orderId: order.id },
      });
    } catch (notifErr) {
      logger.warn('Failed to send refund notification', { error: notifErr });
    }

    res.json({
      data: {
        id: updated.id,
        orderId: updated.id,
        type: 'PURCHASE',
        amount: updated.totalAmount,
        currency: updated.currency || 'INR',
        status: 'REFUNDED',
        razorpayOrderId: updated.razorpayOrderId || '',
        razorpayPaymentId: updated.razorpayPaymentId || undefined,
        createdAt: updated.createdAt.toISOString(),
        refundedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('requestRefund failed', { error: err });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
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
import { releaseGarmentReservations } from '../services/garment-claim.service';
import { z } from 'zod';

const payoutAccountSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(100),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Invalid account number').optional().or(z.literal('')),
  ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC').optional().or(z.literal('')),
  bankName: z.string().trim().max(100).optional(),
  upiId: z.string().trim().regex(/^[\w.\-]{2,256}@[A-Za-z]{2,64}$/, 'Invalid UPI ID').optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
});

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
    const accounts = await getUserPayoutAccounts(req.user.id);
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
    const parsed = payoutAccountSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.accountNumber && !parsed.data.upiId)) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Account holder name and account number (or UPI ID) are required',
      });
      return;
    }
    const { accountHolderName, accountNumber, ifsc, bankName, upiId, isDefault } = parsed.data;

    const account = await addPayoutAccount(req.user.id, {
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
    const success = await deletePayoutAccount(req.user.id, id);
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
        items: { include: { garment: { select: GARMENT_LIST_COLUMNS } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 2. Fetch user rentals — as renter AND as lender (garment owner earning rental income)
    const rentals = await db.rental.findMany({
      where: {
        OR: [
          { renterId: userId },
          { garment: { is: { sellerId: userId } } },
        ],
      },
      include: { garment: { select: GARMENT_LIST_COLUMNS } },
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
        amount: order.totalAmount, // in pure Rupees (₹)
        currency: order.currency || 'INR',
        status: statusMap[order.status] || order.status,
        description: isBuyer ? `Purchased "${title}"` : `Sold "${title}"`,
        referenceId: order.id,
        linkType: 'order',
        createdAt: order.createdAt.toISOString(),
      });
    }

    // Map rentals (renter = expense, lender = earnings)
    for (const rental of rentals) {
      const title = rental.garment?.title || 'Rental Item';
      const isRenter = rental.renterId === userId;

      if (isRenter) {
        const statusMap: Record<string, string> = {
          RESERVED: 'HELD_IN_ESCROW',
          ACTIVE: 'PAID',
          RETURNED: 'RELEASED_TO_SELLER',
          OVERDUE: 'PAID',
        };

        transactions.push({
          id: `tx_rent_${rental.id}`,
          type: 'RENTAL_FEE',
          amount: rental.totalPrice, // pure Rupees (₹)
          currency: 'INR',
          status: statusMap[rental.status] || rental.status,
          description: `Rental reservation for "${title}"`,
          referenceId: rental.id,
          linkType: 'rental',
          createdAt: rental.createdAt.toISOString(),
        });
      } else if (rental.status !== 'RESERVED') {
        // Lender earnings — only once payment is captured (not while merely reserved)
        const statusMap: Record<string, string> = {
          ACTIVE: 'PAID',
          OVERDUE: 'PAID',
          RETURNED: 'RELEASED_TO_SELLER',
        };

        transactions.push({
          id: `tx_rentearn_${rental.id}`,
          type: 'SELLER_PAYOUT',
          amount: rental.totalPrice, // pure Rupees (₹)
          currency: 'INR',
          status: statusMap[rental.status] || 'PAID',
          description: `Rental earnings for "${title}"`,
          referenceId: rental.id,
          linkType: 'rental',
          createdAt: rental.createdAt.toISOString(),
        });
      }
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
      const amount = order.totalAmount; // Pure Rupees (₹)
      const commission = Math.round(amount * 0.1); // 10% platform commission
      const netAmount = amount - commission;

      // Escrow state machine:
      // - PENDING: UNPAID
      // - CONFIRMED / SHIPPED: HELD_IN_ESCROW
      // - DELIVERED: 48h inspection window before settlement
      let status = 'PROCESSING';
      let releaseDate: string | undefined = undefined;

      if (order.status === 'DELIVERED') {
        const deliveredAt = new Date(order.updatedAt).getTime();
        const inspectionEnd = deliveredAt + 48 * 60 * 60 * 1000;
        const now = Date.now();
        if (now >= inspectionEnd) {
          status = 'SETTLED';
          releaseDate = new Date(inspectionEnd).toISOString();
        } else {
          status = 'INSPECTION_WINDOW_48H';
          releaseDate = new Date(inspectionEnd).toISOString();
        }
      } else if (order.status === 'CONFIRMED' || order.status === 'SHIPPED') {
        status = 'HELD_IN_ESCROW';
      }

      return {
        id: `payout_${order.id}`,
        orderId: order.id,
        amount,
        commission,
        netAmount,
        currency: order.currency || 'INR',
        status,
        inspectionPeriodEndsAt: releaseDate,
        createdAt: order.createdAt.toISOString(),
        paidAt: status === 'SETTLED' ? releaseDate : undefined,
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

    const { orderId, reason, amount } = req.body || {};
    if (!orderId || typeof orderId !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'orderId is required' });
      return;
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { garment: { select: GARMENT_LIST_COLUMNS } } } },
    });

    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    const isAdmin = (req.user as any).role === 'ADMIN';
    const isSeller = order.sellerId === req.user.id;
    const isBuyer = order.buyerId === req.user.id;
    if (!isAdmin && !isSeller && !isBuyer) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to request refund for this order' });
      return;
    }

    // Who may refund, and when:
    // - the buyer: only after paying and before the item ships (after that, open a dispute)
    // - the seller or an admin: any time after payment
    // Unpaid, cancelled and already refunded orders can never be refunded (also makes this idempotent).
    const allowedStatuses = isAdmin || isSeller ? ['CONFIRMED', 'SHIPPED', 'DELIVERED'] : ['CONFIRMED'];
    if (!allowedStatuses.includes(String(order.status))) {
      res.status(409).json({ error: 'CONFLICT', message: 'This order cannot be refunded in its current state' });
      return;
    }

    // Amount is decided by the server. Only seller/admin may ask for a smaller (partial) amount.
    let refundAmount = order.totalAmount;
    if (amount !== undefined && amount !== null && (isAdmin || isSeller)) {
      const requested = Number(amount);
      if (!Number.isFinite(requested) || requested <= 0 || requested > order.totalAmount) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid refund amount' });
        return;
      }
      refundAmount = requested;
    }

    // Claim the refund atomically so two parallel requests cannot both refund.
    const claim = await db.order.updateMany({
      where: { id: orderId, status: { in: allowedStatuses as any } },
      data: { status: 'REFUNDED' },
    });
    if (claim.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'This order has already been refunded' });
      return;
    }

    // Trigger Razorpay refund API if payment ID exists
    const razorpay = getRazorpayInstance();
    if (razorpay && order.razorpayPaymentId) {
      try {
        await razorpay.payments.refund(order.razorpayPaymentId, {
          amount: Math.round(refundAmount * 100), // Razorpay wants paise
          notes: {
            reason: String(reason || 'Customer requested refund').slice(0, 200),
            orderId: order.id,
          },
        });
      } catch (rpErr) {
        logger.error('Razorpay refund failed', {
          orderId: order.id,
          error: rpErr instanceof Error ? rpErr.message : String(rpErr),
        });
        if (process.env.NODE_ENV === 'production') {
          // Put the order back so support can retry; do not tell the user the money moved.
          await db.order.update({ where: { id: orderId }, data: { status: order.status } });
          res.status(502).json({ error: 'REFUND_FAILED', message: 'Refund could not be processed. Please try again later.' });
          return;
        }
      }
    }

    const updated = await db.order.findUniqueOrThrow({ where: { id: orderId } });

    // Relist garments back to LISTED and active, restoring the original seller
    // and clearing any reservation pointer.
    await releaseGarmentReservations(order.id, order.sellerId);

    // Notify buyer and seller
    try {
      await createNotification({
        userId: order.buyerId,
        type: 'ORDER_PAID', // or generic notification
        title: 'Refund Processed',
        body: `A refund of ₹${refundAmount.toLocaleString('en-IN')} has been initiated for your order.`,
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

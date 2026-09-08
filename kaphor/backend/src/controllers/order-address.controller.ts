/**
 * PATCH /orders/:orderId/address — set shipping address for an order
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

export async function setOrderShippingAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { orderId } = req.params;
    const { addressId, address: inlineAddress } = req.body as {
      addressId?: string;
      address?: {
        fullName: string;
        phone: string;
        line1: string;
        line2?: string | null;
        landmark?: string | null;
        city: string;
        state: string;
        pincode: string;
      };
    };

    // Verify order ownership
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, status: true },
    });

    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }
    if (order.buyerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not your order' });
      return;
    }
    if (order.status !== 'PENDING') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Can only set address on pending orders' });
      return;
    }

    let shippingAddress: Record<string, unknown>;

    if (addressId) {
      // Use a saved address
      const saved = await db.address.findFirst({
        where: { id: addressId, userId: req.user.id },
      });
      if (!saved) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Address not found' });
        return;
      }
      shippingAddress = {
        addressId: saved.id,
        label: saved.label,
        fullName: saved.fullName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2,
        landmark: saved.landmark,
        city: saved.city,
        state: saved.state,
        pincode: saved.pincode,
        country: saved.country,
      };
    } else if (inlineAddress) {
      // Use inline address
      shippingAddress = {
        fullName: inlineAddress.fullName,
        phone: inlineAddress.phone,
        line1: inlineAddress.line1,
        line2: inlineAddress.line2 ?? null,
        landmark: inlineAddress.landmark ?? null,
        city: inlineAddress.city,
        state: inlineAddress.state,
        pincode: inlineAddress.pincode,
        country: 'India',
      };
    } else {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'addressId or address is required' });
      return;
    }

    const updated = await db.order.update({
      where: { id: orderId },
      data: { shippingAddress: shippingAddress as any },
    });

    res.json({
      data: {
        orderId: updated.id,
        shippingAddress,
      },
    });
  } catch (e) {
    logger.error('setOrderShippingAddress failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to set shipping address' });
  }
}

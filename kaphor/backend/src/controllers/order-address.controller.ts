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
    const { addressId, address: rawInline } = (req.body || {}) as {
      addressId?: unknown;
      address?: unknown;
    };

    if (addressId !== undefined && addressId !== null && (typeof addressId !== 'string' || addressId.length > 64)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid addressId' });
      return;
    }

    // Validate + whitelist inline address fields
    const str = (v: unknown, max: number, required: boolean): string | null | undefined => {
      if (v === undefined || v === null || v === '') return required ? undefined : null;
      if (typeof v !== 'string') return undefined;
      const t = v.trim();
      if (!t) return required ? undefined : null;
      if (t.length > max) return undefined;
      return t;
    };
    let inlineAddress:
      | { fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string }
      | undefined;
    if (!addressId && rawInline !== undefined && rawInline !== null) {
      if (typeof rawInline !== 'object' || Array.isArray(rawInline)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid address' });
        return;
      }
      const a = rawInline as Record<string, unknown>;
      const fullName = str(a.fullName, 100, true);
      const phone = str(a.phone, 20, true);
      const line1 = str(a.line1, 200, true);
      const line2 = str(a.line2, 200, false);
      const landmark = str(a.landmark, 200, false);
      const city = str(a.city, 100, true);
      const state = str(a.state, 100, true);
      const pincode = str(a.pincode, 10, true);
      if (!fullName || !phone || !line1 || !city || !state || !pincode || line2 === undefined || landmark === undefined) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid address fields' });
        return;
      }
      inlineAddress = { fullName, phone, line1, line2, landmark, city, state, pincode };
    }

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
        line2: inlineAddress.line2,
        landmark: inlineAddress.landmark,
        city: inlineAddress.city,
        state: inlineAddress.state,
        pincode: inlineAddress.pincode,
        country: 'India',
      };
    } else {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'addressId or address is required' });
      return;
    }

    const result = await db.order.updateMany({
      where: { id: orderId, buyerId: req.user.id, status: 'PENDING' },
      data: { shippingAddress: shippingAddress as any },
    });
    if (result.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Order is no longer pending' });
      return;
    }

    res.json({
      data: {
        orderId: order.id,
        shippingAddress,
      },
    });
  } catch (e) {
    logger.error('setOrderShippingAddress failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to set shipping address' });
  }
}

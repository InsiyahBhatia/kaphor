import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * GET /users/me/addresses — list all saved addresses for current user
 */
export async function listAddresses(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const addresses = await db.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        label: true,
        fullName: true,
        phone: true,
        line1: true,
        line2: true,
        landmark: true,
        city: true,
        state: true,
        pincode: true,
        isDefault: true,
        createdAt: true,
      },
    });

    res.json({ data: addresses });
  } catch (e) {
    logger.error('listAddresses failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load addresses' });
  }
}

/**
 * POST /users/me/addresses — create a new address
 */
export async function createAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const data = req.body; // validated by middleware
    const userId = req.user.id;

    // If setting as default, unset all other defaults first
    if (data.isDefault) {
      await db.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await db.address.create({
      data: {
        userId,
        label: data.label,
        fullName: data.fullName,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2 ?? null,
        landmark: data.landmark ?? null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        isDefault: data.isDefault ?? false,
        country: 'India',
      },
    });

    res.status(201).json({ data: address });
  } catch (e) {
    logger.error('createAddress failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create address' });
  }
}

/**
 * PUT /users/me/addresses/:id — update an address
 */
export async function updateAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { id } = req.params;
    const data = req.body as Record<string, unknown>;
    const userId = req.user.id;

    // Verify ownership
    const existing = await db.address.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Address not found' });
      return;
    }

    // If setting as default, unset all other defaults first
    if (data.isDefault === true) {
      await db.address.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await db.address.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: String(data.label) }),
        ...(data.fullName !== undefined && { fullName: String(data.fullName) }),
        ...(data.phone !== undefined && { phone: String(data.phone) }),
        ...(data.line1 !== undefined && { line1: String(data.line1) }),
        ...(data.line2 !== undefined && { line2: data.line2 === null ? null : String(data.line2) }),
        ...(data.landmark !== undefined && { landmark: data.landmark === null ? null : String(data.landmark) }),
        ...(data.city !== undefined && { city: String(data.city) }),
        ...(data.state !== undefined && { state: String(data.state) }),
        ...(data.pincode !== undefined && { pincode: String(data.pincode) }),
        ...(data.isDefault !== undefined && { isDefault: Boolean(data.isDefault) }),
      },
    });

    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAddress failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update address' });
  }
}

/**
 * DELETE /users/me/addresses/:id — delete an address
 */
export async function deleteAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { id } = req.params;
    const userId = req.user.id;

    const existing = await db.address.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Address not found' });
      return;
    }

    await db.address.delete({ where: { id } });

    // If the deleted address was default, assign a new default
    if (existing.isDefault) {
      const nextDefault = await db.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (nextDefault) {
        await db.address.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ data: { success: true } });
  } catch (e) {
    logger.error('deleteAddress failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete address' });
  }
}

/**
 * POST /users/me/addresses/:id/default — set as default address
 */
export async function setDefaultAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

    const { id } = req.params;
    const userId = req.user.id;

    const existing = await db.address.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Address not found' });
      return;
    }

    // Unset all defaults for this user
    await db.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set the new default
    const updated = await db.address.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({ data: updated });
  } catch (e) {
    logger.error('setDefaultAddress failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to set default address' });
  }
}

import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createNotification } from '../services/notification.service';
import { emitToUser } from '../lib/socket';

/**
 * POST /garments/:id/initiate-resell
 * Owner marks a garment for resale: OWNERSHIP → SELL_INTENT
 */
export async function initiateResell(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const garment = await db.garment.findUnique({ where: { id } });

    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }

    if (garment.sellerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this garment' });
      return;
    }

    if (garment.lifecycleState !== 'OWNERSHIP') {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: `Cannot resell from state ${garment.lifecycleState}. Must be in OWNERSHIP.`,
      });
      return;
    }

    const updated = await db.garment.update({
      where: { id },
      data: { lifecycleState: 'SELL_INTENT' },
    });

    logger.info('Garment marked for resale', { garmentId: id, userId: req.user.id });

    res.json({ data: { id: updated.id, lifecycleState: updated.lifecycleState } });
  } catch (err) {
    logger.error('initiateResell failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /garments/:id/relist
 * Seller confirms relisting: SELL_INTENT → LISTED
 */
export async function relistGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const garment = await db.garment.findUnique({ where: { id } });

    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }

    if (garment.sellerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this garment' });
      return;
    }

    if (garment.lifecycleState !== 'SELL_INTENT') {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: `Cannot relist from state ${garment.lifecycleState}. Must be in SELL_INTENT.`,
      });
      return;
    }

    const updated = await db.garment.update({
      where: { id },
      data: {
        lifecycleState: 'LISTED',
        isActive: true,
        reuseCount: { increment: 1 },
      },
    });

    logger.info('Garment relisted', { garmentId: id, userId: req.user.id, reuseCount: updated.reuseCount });

    res.json({ data: { id: updated.id, lifecycleState: updated.lifecycleState, reuseCount: updated.reuseCount } });
  } catch (err) {
    logger.error('relistGarment failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /garments/:id/circular-end
 * User sends garment to end-of-life circular path: CIRCULATION → REUSE_UPCYCLE_RECYCLE
 */
export async function markCircularEnd(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { id } = req.params;
    const garment = await db.garment.findUnique({ where: { id } });

    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }

    if (garment.sellerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this garment' });
      return;
    }

    if (garment.lifecycleState !== 'CIRCULATION') {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: `Cannot mark circular end from state ${garment.lifecycleState}. Must be in CIRCULATION.`,
      });
      return;
    }

    const updated = await db.garment.update({
      where: { id },
      data: {
        lifecycleState: 'REUSE_UPCYCLE_RECYCLE',
        isActive: false,
      },
    });

    // Notify the owner about circular completion
    await createNotification({
      userId: req.user.id,
      type: 'CIRCULAR_COMPLETED',
      title: '♻️ Circular Journey Complete',
      body: `"${garment.title}" has been routed to reuse, upcycling, or recycling. Thank you for closing the loop!`,
      data: { garmentId: id },
    });

    emitToUser(req.user.id, 'lifecycle:update', {
      garmentId: id,
      newState: 'REUSE_UPCYCLE_RECYCLE',
      message: 'Your garment has entered the circular end-of-life path.',
    });

    logger.info('Garment marked for circular end', { garmentId: id, userId: req.user.id });

    res.json({ data: { id: updated.id, lifecycleState: updated.lifecycleState } });
  } catch (err) {
    logger.error('markCircularEnd failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}



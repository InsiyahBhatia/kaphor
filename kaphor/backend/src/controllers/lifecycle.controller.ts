import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createNotification } from '../services/notification.service';
import { emitToUser } from '../lib/socket';
import { ImpactService } from '../services/impact.service';

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
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }
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

    // Atomic transition guarded by owner + current state
    const moved = await db.garment.updateMany({
      where: { id, sellerId: req.user.id, lifecycleState: 'OWNERSHIP', reservedOrderId: null },
      data: { lifecycleState: 'SELL_INTENT' },
    });
    if (moved.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Garment state changed; please refresh' });
      return;
    }

    logger.info('Garment marked for resale', { garmentId: id, userId: req.user.id });

    res.json({ data: { id, lifecycleState: 'SELL_INTENT' } });
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
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }
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

    const relisted = await db.garment.updateMany({
      where: { id, sellerId: req.user.id, lifecycleState: 'SELL_INTENT', reservedOrderId: null },
      data: {
        lifecycleState: 'LISTED',
        isActive: true,
        reuseCount: { increment: 1 },
      },
    });
    if (relisted.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Garment state changed; please refresh' });
      return;
    }
    const updated = await db.garment.findUniqueOrThrow({ where: { id } });

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
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }
    const garment = await db.garment.findUnique({ where: { id } });

    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found' });
      return;
    }

    if (garment.sellerId !== req.user.id) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not own this garment' });
      return;
    }

    const allowableStates = ['CIRCULATION', 'DECLINE', 'OWNERSHIP'];
    if (!allowableStates.includes(garment.lifecycleState)) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: `Cannot mark circular end from state ${garment.lifecycleState}. Must be in ${allowableStates.join(', ')}.`,
      });
      return;
    }

    // Atomic: only one request wins the transition (prevents duplicate notifications / impact records)
    const ended = await db.garment.updateMany({
      where: { id, sellerId: req.user.id, lifecycleState: { in: allowableStates as any }, reservedOrderId: null },
      data: {
        lifecycleState: 'REUSE_UPCYCLE_RECYCLE',
        isActive: false,
      },
    });
    if (ended.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Garment state changed; please refresh' });
      return;
    }
    const updated = { id, lifecycleState: 'REUSE_UPCYCLE_RECYCLE' };

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

    // Record textile waste diversion impact
    try {
      await ImpactService.recordCircularEndImpact(id, req.user.id, 'RECYCLE');
    } catch (impactErr) {
      logger.warn('Failed to record circular end impact', { error: impactErr });
    }

    logger.info('Garment marked for circular end', { garmentId: id, userId: req.user.id });

    res.json({ data: { id: updated.id, lifecycleState: updated.lifecycleState } });
  } catch (err) {
    logger.error('markCircularEnd failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}



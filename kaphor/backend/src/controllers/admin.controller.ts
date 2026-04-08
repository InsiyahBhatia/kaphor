import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

export async function getAdminMonitor(req: Request, res: Response): Promise<void> {
  try {
    const [
      bespokePending, 
      swapsRequested, 
      rentalsReserved, 
      ordersPending,
      totalUsers,
      totalGarments,
    ] = await Promise.all([
      db.bespokeRequest.count({ where: { status: 'PENDING' } }),
      db.swap.count({ where: { status: 'REQUESTED' } }),
      db.rental.count({ where: { status: 'RESERVED' } }),
      db.order.count({ where: { status: 'PENDING' } }),
      db.user.count(),
      db.garment.count({ where: { isActive: true } }),
    ]);

    // Calculate confirmed order volume
    const confirmedVolume = await db.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } }
    });

    res.json({
      data: {
        bespokePending,
        swapsRequested,
        rentalsReserved,
        ordersPending,
        totalUsers,
        totalGarments,
        revenuePotential: confirmedVolume._sum.totalAmount ?? 0,
      },
    });
  } catch (e) {
    logger.error('getAdminMonitor failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}


export async function listAdminBespokeRequests(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    const requests = await db.bespokeRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    res.json({ data: requests });
  } catch (e) {
    logger.error('listAdminBespokeRequests failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateBespokeRequestStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };
    if (!status || typeof status !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'status is required' });
      return;
    }

    const updated = await db.bespokeRequest.update({
      where: { id },
      data: { status },
    });

    res.json({ data: updated });
  } catch (e) {
    logger.error('updateBespokeRequestStatus failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function listAdminSwaps(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    const swaps = await db.swap.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        initiator: { select: { id: true, displayName: true } },
        receiver: { select: { id: true, displayName: true } },
        offeredGarment: { select: { id: true, title: true, brand: true } },
        wantedGarment: { select: { id: true, title: true, brand: true } },
      },
    });

    res.json({ data: swaps });
  } catch (e) {
    logger.error('listAdminSwaps failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function listAdminRentals(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    const rentals = await db.rental.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        renter: { select: { id: true, displayName: true, email: true } },
        garment: { select: { id: true, title: true, brand: true, sellerId: true } },
      },
    });

    res.json({ data: rentals });
  } catch (e) {
    logger.error('listAdminRentals failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function listAdminUsers(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        tier: true,
        isActive: true,
        createdAt: true,
      }
    });
    res.json({ data: users });
  } catch (e) {
    logger.error('listAdminUsers failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive, role, tier } = req.body as { 
      isActive?: boolean; 
      role?: string; 
      tier?: string; 
    };

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(role ? { role: role as any } : {}),
        ...(tier ? { tier: tier as any } : {}),
      },
    });

    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAdminUser failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}



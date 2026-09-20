import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { auditLog } from '../services/audit.service';

const PAID_ORDER_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED'];
const PAID_RENTAL_STATUSES = ['RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED', 'OVERDUE'];
const SWAP_ADMIN_STATUSES = ['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
const UPCYCLE_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const REPORT_STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'];
const VERIFICATION_STATUSES = ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'];

function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}

function dayKey(iso: Date): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function getAdminMonitor(req: Request, res: Response): Promise<void> {
  try {
    const [
      bespokePending, 
      swapsRequested, 
      rentalsReserved, 
      ordersPending,
      totalUsers,
      totalGarments,
      upcyclePending,
      reportsPending,
      verificationsPending,
      circularScheduled,
      overdueRentals,
    ] = await Promise.all([
      db.bespokeRequest.count({ where: { status: 'PENDING' } }),
      db.swap.count({ where: { status: 'REQUESTED' } }),
      db.rental.count({ where: { status: 'RESERVED' } }),
      db.order.count({ where: { status: 'PENDING' } }),
      db.user.count(),
      db.garment.count({ where: { isActive: true } }),
      db.upcycleRequest.count({ where: { status: 'PENDING_REVIEW' } }),
      db.userReport.count({ where: { status: 'PENDING' } }),
      db.user.count({ where: { verificationStatus: 'PENDING_REVIEW' } }),
      db.circularRequest.count({ where: { status: 'SCHEDULED' } }),
      db.rental.count({ where: { status: 'OVERDUE' } }),
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
        upcyclePending,
        reportsPending,
        verificationsPending,
        circularScheduled,
        overdueRentals,
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
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const page = Math.max(1, Math.floor(Number(req.query.page ?? 1)) || 1);
    const limit = clampLimit(req.query.limit, 50, 100);
    const verificationStatus = typeof req.query.verification === 'string' && req.query.verification ? req.query.verification : undefined;

    const where: any = verificationStatus ? { verificationStatus } : {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          tier: true,
          isActive: true,
          isVerified: true,
          verificationStatus: true,
          verificationType: true,
          createdAt: true,
        }
      }),
    ]);
    res.json({ data: users, meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
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

export async function deleteAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (req.user?.id === id) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'You cannot delete your own account.' });
      return;
    }

    await db.user.delete({
      where: { id },
    });

    res.json({ data: { success: true } });
  } catch (e) {
    logger.error('deleteAdminUser failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function listAdminGarments(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const showInactive = String(req.query.active).toLowerCase() === 'false';
    const where: any = showInactive ? {} : { isActive: true };

    const lifecycle = typeof req.query.lifecycle === 'string' ? req.query.lifecycle : undefined;
    if (lifecycle) where.lifecycleState = lifecycle;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { seller: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } },
      ];
    }

    const [total, garments] = await Promise.all([
      db.garment.count({ where }),
      db.garment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          seller: { select: { id: true, displayName: true } }
        }
      })
    ]);
    res.json({ data: garments, meta: { total } });
  } catch (e) {
    logger.error('listAdminGarments failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/analytics?range=7d|30d|90d
 * Per-day buckets for charts plus all-time totals and top lists.
 */
export async function getAdminAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const rawRange = String(req.query.range || '30d');
    const range = rawRange === '7d' || rawRange === '90d' ? rawRange : '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [users, orders, garments, rentals, swaps, events] = await Promise.all<
      [any[], any[], any[], any[], any[], any[]]
    >([
      db.user.findMany({ where: { createdAt: { gte: start } }, select: { id: true, role: true, createdAt: true } }),
      db.order.findMany({ where: { createdAt: { gte: start } }, select: { id: true, status: true, totalAmount: true, createdAt: true } }),
      db.garment.findMany({ select: { id: true, listingType: true, category: true, brand: true, isActive: true, createdAt: true, sellerId: true, price: true } }),
      db.rental.findMany({ where: { createdAt: { gte: start } }, select: { id: true, status: true, totalPrice: true, createdAt: true } }),
      db.swap.findMany({ where: { createdAt: { gte: start } }, select: { id: true, status: true, createdAt: true } }),
      db.behaviourEvent.findMany({ where: { createdAt: { gte: start } }, select: { eventType: true, createdAt: true } }),
    ]);

    const bucketMap = new Map<string, any>();
    const buckets: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const key = dayKey(d);
      const bucket = { date: key, users: 0, orders: 0, gmvSale: 0, gmvRental: 0, rentals: 0, swaps: 0, events: 0 };
      buckets.push(bucket);
      bucketMap.set(key, bucket);
    }

    users.forEach((u) => { const b = bucketMap.get(dayKey(u.createdAt)); if (b) b.users += 1; });
    events.forEach((e) => { const b = bucketMap.get(dayKey(e.createdAt)); if (b) b.events += 1; });
    orders.forEach((o) => {
      const b = bucketMap.get(dayKey(o.createdAt));
      if (!b) return;
      b.orders += 1;
      if (PAID_ORDER_STATUSES.includes(o.status)) b.gmvSale += o.totalAmount;
    });
    rentals.forEach((r) => {
      const b = bucketMap.get(dayKey(r.createdAt));
      if (!b) return;
      b.rentals += 1;
      if (PAID_RENTAL_STATUSES.includes(r.status)) b.gmvRental += r.totalPrice;
    });
    swaps.forEach((s) => { const b = bucketMap.get(dayKey(s.createdAt)); if (b) b.swaps += 1; });

    const activeGarments = garments.filter((g) => g.isActive);
    const topCategories = groupByTop(activeGarments.map((g) => g.category || 'UNKNOWN'), 5);
    const topBrands = groupByTop(activeGarments.filter((g) => g.brand).map((g) => g.brand), 5);

    const sellerCounts = new Map<string, { count: number; listingType: string }>();
    activeGarments.forEach((g) => {
      const cur = sellerCounts.get(g.sellerId) || { count: 0, listingType: g.listingType };
      cur.count += 1;
      sellerCounts.set(g.sellerId, cur);
    });
    const topSellerIds = [...sellerCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([id]) => id);
    const topUsers: any[] = topSellerIds.length
      ? await db.user.findMany({ where: { id: { in: topSellerIds } }, select: { id: true, displayName: true, email: true, tier: true } })
      : [];
    const topSellers = topSellerIds.map((id) => {
      const u = topUsers.find((t) => t.id === id);
      return { id, displayName: u?.displayName || 'Unknown', email: u?.email || '', tier: u?.tier, activeListings: sellerCounts.get(id)!.count };
    });

    const eventTypeCounts = new Map<string, number>();
    events.forEach((e) => eventTypeCounts.set(e.eventType, (eventTypeCounts.get(e.eventType) || 0) + 1));
    const eventBreakdown = [...eventTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));

    const [totalUsers, activeListings, totalOrders, gmvAgg, totalRentals, overdueRentals, pendingSwaps] = await Promise.all([
      db.user.count(),
      db.garment.count({ where: { isActive: true, lifecycleState: 'LISTED' } }),
      db.order.count(),
      db.order.aggregate({ _sum: { totalAmount: true }, where: { status: { in: PAID_ORDER_STATUSES } } }),
      db.rental.count(),
      db.rental.count({ where: { status: 'OVERDUE' } }),
      db.swap.count({ where: { status: 'REQUESTED' } }),
    ]);

    res.json({
      data: {
        range,
        days,
        buckets,
        totals: {
          totalUsers,
          activeListings,
          totalOrders,
          totalGmv: gmvAgg._sum.totalAmount ?? 0,
          totalRentals,
          overdueRentals,
          pendingSwaps,
        },
        topCategories,
        topBrands,
        topSellers,
        eventBreakdown,
      },
    });
  } catch (e) {
    logger.error('getAdminAnalytics failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

function groupByTop(values: string[], take: number): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([label, count]) => ({ label, count }));
}

/**
 * GET /admin/health
 * Real diagnostics: DB ping, process uptime, server time.
 */
export async function getAdminHealth(req: Request, res: Response): Promise<void> {
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbPingMs = Date.now() - t0;
    res.json({
      data: {
        healthy: dbPingMs < 2000,
        dbPingMs,
        uptimeSec: Math.floor(process.uptime()),
        serverTime: new Date().toISOString(),
      },
    });
  } catch (e) {
    logger.error('getAdminHealth failed', { error: e instanceof Error ? e.message : String(e) });
    res.json({
      data: { healthy: false, dbPingMs: null, uptimeSec: Math.floor(process.uptime()), serverTime: new Date().toISOString() },
    });
  }
}

/**
 * GET /admin/orders?status=&q=&page=&limit=
 */
export async function listAdminOrders(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const page = Math.max(1, Math.floor(Number(req.query.page ?? 1)) || 1);
    const limit = clampLimit(req.query.limit, 20, 100);

    const where: any = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { id: q },
        { buyer: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } },
        { seller: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } },
        { items: { some: { garment: { title: { contains: q, mode: 'insensitive' } } } } },
      ];
    }

    const [total, orders] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          buyer: { select: { id: true, displayName: true, email: true } },
          seller: { select: { id: true, displayName: true, email: true } },
          items: { include: { garment: { select: { id: true, title: true, brand: true, images: true } } } },
        },
      }),
    ]);

    res.json({ data: orders, meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (e) {
    logger.error('listAdminOrders failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/orders/:id
 */
export async function getAdminOrder(req: Request, res: Response): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: req.params.id },
      include: {
        buyer: { select: { id: true, displayName: true, email: true, phone: true } },
        seller: { select: { id: true, displayName: true, email: true } },
        items: { include: { garment: { select: { id: true, title: true, brand: true, images: true, category: true, size: true, condition: true } } } },
        peerReview: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }
    res.json({ data: order });
  } catch (e) {
    logger.error('getAdminOrder failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/reports?status=
 */
export async function listAdminReports(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const limit = clampLimit(req.query.limit, 50, 100);
    const reports = await db.userReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        reporter: { select: { id: true, displayName: true, email: true } },
        reportedUser: { select: { id: true, displayName: true, email: true } },
      },
    });
    res.json({ data: reports });
  } catch (e) {
    logger.error('listAdminReports failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * PATCH /admin/reports/:id  { status: RESOLVED | DISMISSED }
 */
export async function updateAdminReport(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !REPORT_STATUSES.includes(status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: `status must be one of ${REPORT_STATUSES.join(', ')}` });
      return;
    }
    const updated = await db.userReport.update({ where: { id: req.params.id }, data: { status } });
    await auditLog({ userId: req.user?.id, action: 'REPORT_UPDATE', resource: 'UserReport', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAdminReport failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/upcycles?status=
 */
export async function listAdminUpcycles(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const limit = clampLimit(req.query.limit, 50, 100);
    const items = await db.upcycleRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        garment: { select: { id: true, title: true, brand: true, category: true, images: true } },
      },
    });
    res.json({ data: items });
  } catch (e) {
    logger.error('listAdminUpcycles failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * PATCH /admin/upcycles/:id  { status, adminNotes? }
 */
export async function updateAdminUpcycle(req: Request, res: Response): Promise<void> {
  try {
    const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
    if (!status || !UPCYCLE_STATUSES.includes(status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: `status must be one of ${UPCYCLE_STATUSES.join(', ')}` });
      return;
    }
    const updated = await db.upcycleRequest.update({
      where: { id: req.params.id },
      data: { status, ...(adminNotes !== undefined ? { adminNotes } : {}) },
    });
    await auditLog({ userId: req.user?.id, action: 'UPCYCLE_UPDATE', resource: 'UpcycleRequest', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAdminUpcycle failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/verifications?status=
 */
export async function listAdminVerifications(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : 'PENDING_REVIEW';
    const limit = clampLimit(req.query.limit, 50, 100);
    const users = await db.user.findMany({
      where: { verificationStatus: status as any },
      orderBy: { verificationSubmittedAt: 'desc' },
      take: limit,
      select: {
        id: true, email: true, username: true, displayName: true, tier: true, isActive: true,
        verificationStatus: true, verificationType: true, verificationDocUrl: true, idNumberLast4: true,
        verificationSubmittedAt: true, createdAt: true,
      },
    });
    res.json({ data: users });
  } catch (e) {
    logger.error('listAdminVerifications failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * PATCH /admin/verifications/:id  { status: VERIFIED | REJECTED }
 */
export async function updateAdminVerification(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !VERIFICATION_STATUSES.includes(status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: `status must be one of ${VERIFICATION_STATUSES.join(', ')}` });
      return;
    }
    const updated = await db.user.update({
      where: { id: req.params.id },
      data: { verificationStatus: status as any, isVerified: status === 'VERIFIED' },
    });
    await auditLog({ userId: req.user?.id, action: 'VERIFICATION_UPDATE', resource: 'User', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAdminVerification failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/audit?page=&limit=&action=
 */
export async function listAdminAudit(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page ?? 1)) || 1);
    const limit = clampLimit(req.query.limit, 50, 100);
    const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined;
    const where = action ? { action } : {};
    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, displayName: true, email: true } } },
      }),
    ]);
    res.json({ data: logs, meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (e) {
    logger.error('listAdminAudit failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * PATCH /admin/swaps/:id  { status: ACCEPTED | REJECTED | COMPLETED | CANCELLED }
 * Admin override for swap lifecycle (barter, no payment flow risk on transitions here).
 */
export async function updateAdminSwap(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !SWAP_ADMIN_STATUSES.includes(status)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: `status must be one of ${SWAP_ADMIN_STATUSES.join(', ')}` });
      return;
    }
    const existing = await db.swap.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Swap not found' });
      return;
    }
    const updated = await db.swap.update({
      where: { id: req.params.id },
      data: { status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) },
    });
    await auditLog({ userId: req.user?.id, action: 'SWAP_UPDATE', resource: 'Swap', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAdminSwap failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /admin/circular-requests?status=
 */
export async function listAdminCircularRequests(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const limit = clampLimit(req.query.limit, 50, 100);
    const items = await db.circularRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, displayName: true, email: true, phone: true } },
        garment: { select: { id: true, title: true, brand: true, category: true, images: true } },
      },
    });
    res.json({ data: items });
  } catch (e) {
    logger.error('listAdminCircularRequests failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/**
 * PATCH /admin/circular-requests/:id  { status }
 */
export async function updateAdminCircularRequest(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body as { status?: string };
    if (!status || typeof status !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'status is required' });
      return;
    }
    const updated = await db.circularRequest.update({ where: { id: req.params.id }, data: { status } });
    await auditLog({ userId: req.user?.id, action: 'CIRCULAR_UPDATE', resource: 'CircularRequest', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    logger.error('updateAdminCircularRequest failed', { error: e instanceof Error ? e.message : String(e) });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

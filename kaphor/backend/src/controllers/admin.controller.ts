import { cacheGet, cacheSet } from '../lib/cache';
import { invalidateAuthUser } from '../lib/authCache';
import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { Request, Response } from 'express';
import { z } from 'zod';
import db, { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { auditLog } from '../services/audit.service';

const PAID_ORDER_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED'];
const PAID_RENTAL_STATUSES = ['RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED', 'OVERDUE'];
const SWAP_ADMIN_STATUSES = ['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
const UPCYCLE_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const REPORT_STATUSES = ['PENDING', 'RESOLVED', 'DISMISSED'];
const VERIFICATION_STATUSES = ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'];
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const SWAP_STATUSES = ['REQUESTED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
const RENTAL_STATUSES = ['REQUESTED', 'APPROVED', 'DECLINED', 'RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED', 'CANCELLED', 'OVERDUE'];
const BESPOKE_STATUSES = ['PENDING', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const CIRCULAR_STATUSES = ['SCHEDULED', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];
const USER_ROLES = ['BUYER', 'SELLER', 'BOTH', 'ADMIN'] as const;
const USER_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'ELITE'] as const;
const GARMENT_STATES = ['LISTED', 'INTEREST', 'PURCHASE_INTENT', 'SELL_INTENT', 'OWNERSHIP', 'DECLINE', 'CIRCULATION', 'REUSE_UPCYCLE_RECYCLE', 'RESERVED_SALE'];

const MAX_SEARCH_LEN = 100;
const MAX_ID_LEN = 64;

/** Explicit safe projection for users: never secrets (passwordHash, tokens, pushToken, login counters). */
const SAFE_USER_SELECT = {
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
  idNumberLast4: true,
  createdAt: true,
} as const;

const statusBody = (values: readonly string[]) => z.object({ status: z.enum(values as [string, ...string[]]) }).strict();
const upcycleBody = z.object({
  status: z.enum(UPCYCLE_STATUSES as [string, ...string[]]),
  adminNotes: z.string().max(2000).optional(),
}).strict();
const userUpdateBody = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(USER_ROLES).optional(),
  tier: z.enum(USER_TIERS).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields supplied' });

/** Query string param: undefined if absent/empty, null if invalid (non-string or too long). */
function queryStr(v: unknown, max = MAX_SEARCH_LEN): string | undefined | null {
  if (v === undefined || v === '') return undefined;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length > max) return null;
  return t || undefined;
}

/** Query enum param: undefined if absent, null if invalid. */
function queryEnum(v: unknown, allowed: readonly string[]): string | undefined | null {
  const s = queryStr(v, 40);
  if (s === undefined || s === null) return s;
  return allowed.includes(s) ? s : null;
}

function validId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LEN;
}

function badRequest(res: Response, message = 'Invalid request'): void {
  res.status(400).json({ error: 'BAD_REQUEST', message });
}

function fail(res: Response, name: string, e: unknown): void {
  if ((e as any)?.code === 'P2025') {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Record not found' });
    return;
  }
  logger.error(`${name} failed`, { error: e instanceof Error ? e.message : String(e) });
  res.status(500).json({ error: 'INTERNAL_ERROR' });
}

function parsePage(v: unknown): number {
  const n = Math.floor(typeof v === 'string' ? Number(v) : 1);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1;
}

async function revokeRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
}

async function otherActiveAdminCount(excludeId: string): Promise<number> {
  return prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: excludeId } } });
}

function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}

function dayKey(iso: Date): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function getAdminMonitor(req: Request, res: Response): Promise<void> {
  try {
    const cacheKey = 'stats:admin:monitor';
    const cached = cacheGet<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

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

    const payload = {
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
    };

    cacheSet(cacheKey, payload, 30_000);
    res.json(payload);
  } catch (e) {
    fail(res, 'getAdminMonitor', e);
  }
}


export async function listAdminBespokeRequests(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, BESPOKE_STATUSES);
    if (status === null) return badRequest(res, 'Invalid status');
    const limit = clampLimit(req.query.limit, 20, 50);

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
    fail(res, 'listAdminBespokeRequests', e);
  }
}

export async function updateBespokeRequestStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = statusBody(BESPOKE_STATUSES).safeParse(req.body);
    if (!validId(id) || !parsed.success) return badRequest(res, 'Invalid status');
    const { status } = parsed.data;

    const updated = await db.bespokeRequest.update({
      where: { id },
      data: { status },
    });
    await auditLog({ userId: req.user?.id, action: 'BESPOKE_UPDATE', resource: 'BespokeRequest', metadata: { id, status }, req });

    res.json({ data: updated });
  } catch (e) {
    fail(res, 'updateBespokeRequestStatus', e);
  }
}

export async function listAdminSwaps(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, SWAP_STATUSES);
    if (status === null) return badRequest(res, 'Invalid status');
    const limit = clampLimit(req.query.limit, 20, 50);

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
    fail(res, 'listAdminSwaps', e);
  }
}

export async function listAdminRentals(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, RENTAL_STATUSES);
    if (status === null) return badRequest(res, 'Invalid status');
    const limit = clampLimit(req.query.limit, 20, 50);

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
    fail(res, 'listAdminRentals', e);
  }
}

export async function listAdminUsers(req: Request, res: Response): Promise<void> {
  try {
    const q = queryStr(req.query.q);
    const verificationStatus = queryEnum(req.query.verification, VERIFICATION_STATUSES);
    if (q === null || verificationStatus === null) return badRequest(res, 'Invalid query parameters');
    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit, 50, 100);

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
        select: SAFE_USER_SELECT,
      }),
    ]);
    res.json({ data: users, meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (e) {
    fail(res, 'listAdminUsers', e);
  }
}

export async function updateAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = userUpdateBody.safeParse(req.body);
    if (!validId(id) || !parsed.success) return badRequest(res, 'Invalid request body');
    const { isActive, role, tier } = parsed.data;

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
    if (!target) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const demotes = role !== undefined && role !== 'ADMIN' && target.role === 'ADMIN';
    const deactivates = isActive === false && target.isActive;
    if (req.user?.id === id && (demotes || isActive === false)) {
      return badRequest(res, 'You cannot demote or deactivate your own account.');
    }
    if (target.role === 'ADMIN' && target.isActive && (demotes || deactivates)) {
      if ((await otherActiveAdminCount(id)) === 0) {
        return badRequest(res, 'Cannot demote or deactivate the last remaining admin.');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(role ? { role } : {}),
        ...(tier ? { tier } : {}),
      },
      select: SAFE_USER_SELECT,
    });

    invalidateAuthUser(id); // role / active changes must apply on the very next request
    if (isActive === false) await revokeRefreshTokens(id);
    await auditLog({ userId: req.user?.id, action: 'USER_UPDATE', resource: 'User', metadata: { id, isActive, role, tier }, req });

    res.json({ data: updated });
  } catch (e) {
    fail(res, 'updateAdminUser', e);
  }
}

export async function deleteAdminUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!validId(id)) return badRequest(res, 'Invalid id');
    if (req.user?.id === id) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'You cannot delete your own account.' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
    if (!target) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }
    if (target.role === 'ADMIN' && target.isActive && (await otherActiveAdminCount(id)) === 0) {
      return badRequest(res, 'Cannot delete the last remaining admin.');
    }

    await db.user.delete({ where: { id } });
    await revokeRefreshTokens(id);
    await auditLog({ userId: req.user?.id, action: 'USER_DELETE', resource: 'User', metadata: { id }, req });

    res.json({ data: { success: true } });
  } catch (e) {
    fail(res, 'deleteAdminUser', e);
  }
}

export async function listAdminGarments(req: Request, res: Response): Promise<void> {
  try {
    const limit = clampLimit(req.query.limit, 50, 100);
    const showInactive = req.query.active === 'false';
    const where: any = showInactive ? {} : { isActive: true };

    const lifecycle = queryEnum(req.query.lifecycle, GARMENT_STATES);
    const q = queryStr(req.query.q);
    if (lifecycle === null || q === null) return badRequest(res, 'Invalid query parameters');
    if (lifecycle) where.lifecycleState = lifecycle;

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
        select: { ...GARMENT_LIST_COLUMNS, seller: { select: { id: true, displayName: true } } }
      })
    ]);
    res.json({ data: garments, meta: { total } });
  } catch (e) {
    fail(res, 'listAdminGarments', e);
  }
}

/**
 * GET /admin/analytics?range=7d|30d|90d
 * Per-day buckets for charts plus all-time totals and top lists.
 */
export async function getAdminAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const rawRange = typeof req.query.range === 'string' ? req.query.range : '30d';
    const range = rawRange === '7d' || rawRange === '90d' ? rawRange : '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

    const analyticsKey = `stats:admin:analytics:${range}`;
    const cachedAnalytics = cacheGet<any>(analyticsKey);
    if (cachedAnalytics) {
      res.json(cachedAnalytics);
      return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [users, orders, garments, rentals, swaps, events] = await Promise.all<
      [any[], any[], any[], any[], any[], any[]]
    >([
      db.user.findMany({ where: { createdAt: { gte: start } }, select: { id: true, role: true, createdAt: true } }),
      db.order.findMany({ where: { createdAt: { gte: start } }, select: { id: true, status: true, totalAmount: true, createdAt: true } }),
      // Only active listings are used below, so do not read the rest of the table.
      db.garment.findMany({ where: { isActive: true }, select: { id: true, listingType: true, category: true, brand: true, isActive: true, sellerId: true } }),
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

    const analyticsPayload = {
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
    };
    cacheSet(analyticsKey, analyticsPayload, 60_000);
    res.json(analyticsPayload);
  } catch (e) {
    fail(res, 'getAdminAnalytics', e);
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
    const cacheKey = 'stats:admin:health';
    const cached = cacheGet<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbPingMs = Date.now() - t0;
    const payload = {
      data: {
        healthy: dbPingMs < 2000,
        dbPingMs,
        uptimeSec: Math.floor(process.uptime()),
        serverTime: new Date().toISOString(),
      },
    };
    cacheSet(cacheKey, payload, 15_000);
    res.json(payload);
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
    const status = queryEnum(req.query.status, ORDER_STATUSES);
    const q = queryStr(req.query.q);
    if (status === null || q === null) return badRequest(res, 'Invalid query parameters');
    const page = parsePage(req.query.page);
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
    fail(res, 'listAdminOrders', e);
  }
}

/**
 * GET /admin/orders/:id
 */
export async function getAdminOrder(req: Request, res: Response): Promise<void> {
  try {
    if (!validId(req.params.id)) return badRequest(res, 'Invalid id');
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
    fail(res, 'getAdminOrder', e);
  }
}

/**
 * GET /admin/reports?status=
 */
export async function listAdminReports(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, REPORT_STATUSES);
    if (status === null) return badRequest(res, 'Invalid status');
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
    fail(res, 'listAdminReports', e);
  }
}

/**
 * PATCH /admin/reports/:id  { status: RESOLVED | DISMISSED }
 */
export async function updateAdminReport(req: Request, res: Response): Promise<void> {
  try {
    const parsed = statusBody(REPORT_STATUSES).safeParse(req.body);
    if (!validId(req.params.id) || !parsed.success) {
      return badRequest(res, `status must be one of ${REPORT_STATUSES.join(', ')}`);
    }
    const { status } = parsed.data;
    const updated = await db.userReport.update({ where: { id: req.params.id }, data: { status } });
    await auditLog({ userId: req.user?.id, action: 'REPORT_UPDATE', resource: 'UserReport', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    fail(res, 'updateAdminReport', e);
  }
}

/**
 * GET /admin/upcycles?status=
 */
export async function listAdminUpcycles(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, UPCYCLE_STATUSES);
    if (status === null) return badRequest(res, 'Invalid status');
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
    fail(res, 'listAdminUpcycles', e);
  }
}

/**
 * PATCH /admin/upcycles/:id  { status, adminNotes? }
 */
export async function updateAdminUpcycle(req: Request, res: Response): Promise<void> {
  try {
    const parsed = upcycleBody.safeParse(req.body);
    if (!validId(req.params.id) || !parsed.success) {
      return badRequest(res, `status must be one of ${UPCYCLE_STATUSES.join(', ')}`);
    }
    const { status, adminNotes } = parsed.data;
    const updated = await db.upcycleRequest.update({
      where: { id: req.params.id },
      data: { status, ...(adminNotes !== undefined ? { adminNotes } : {}) },
    });
    await auditLog({ userId: req.user?.id, action: 'UPCYCLE_UPDATE', resource: 'UpcycleRequest', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    fail(res, 'updateAdminUpcycle', e);
  }
}

/**
 * GET /admin/verifications?status=
 */
export async function listAdminVerifications(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, VERIFICATION_STATUSES) ?? (req.query.status === undefined || req.query.status === '' ? 'PENDING_REVIEW' : null);
    if (status === null) return badRequest(res, 'Invalid status');
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
    fail(res, 'listAdminVerifications', e);
  }
}

/**
 * PATCH /admin/verifications/:id  { status: VERIFIED | REJECTED }
 */
export async function updateAdminVerification(req: Request, res: Response): Promise<void> {
  try {
    const parsed = statusBody(VERIFICATION_STATUSES).safeParse(req.body);
    if (!validId(req.params.id) || !parsed.success) {
      return badRequest(res, `status must be one of ${VERIFICATION_STATUSES.join(', ')}`);
    }
    const { status } = parsed.data;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { verificationStatus: status as any, isVerified: status === 'VERIFIED' },
      select: SAFE_USER_SELECT,
    });
    await auditLog({ userId: req.user?.id, action: 'VERIFICATION_UPDATE', resource: 'User', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    fail(res, 'updateAdminVerification', e);
  }
}

/**
 * GET /admin/audit?page=&limit=&action=
 */
export async function listAdminAudit(req: Request, res: Response): Promise<void> {
  try {
    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit, 50, 100);
    const action = queryStr(req.query.action, 64);
    if (action === null) return badRequest(res, 'Invalid action');
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
    fail(res, 'listAdminAudit', e);
  }
}

/**
 * PATCH /admin/swaps/:id  { status: ACCEPTED | REJECTED | COMPLETED | CANCELLED }
 * Admin override for swap lifecycle (barter, no payment flow risk on transitions here).
 */
export async function updateAdminSwap(req: Request, res: Response): Promise<void> {
  try {
    const parsed = statusBody(SWAP_ADMIN_STATUSES).safeParse(req.body);
    if (!validId(req.params.id) || !parsed.success) {
      return badRequest(res, `status must be one of ${SWAP_ADMIN_STATUSES.join(', ')}`);
    }
    const { status } = parsed.data;
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
    fail(res, 'updateAdminSwap', e);
  }
}

/**
 * GET /admin/circular-requests?status=
 */
export async function listAdminCircularRequests(req: Request, res: Response): Promise<void> {
  try {
    const status = queryEnum(req.query.status, CIRCULAR_STATUSES);
    if (status === null) return badRequest(res, 'Invalid status');
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
    fail(res, 'listAdminCircularRequests', e);
  }
}

/**
 * PATCH /admin/circular-requests/:id  { status }
 */
export async function updateAdminCircularRequest(req: Request, res: Response): Promise<void> {
  try {
    const parsed = statusBody(CIRCULAR_STATUSES).safeParse(req.body);
    if (!validId(req.params.id) || !parsed.success) return badRequest(res, 'Invalid status');
    const { status } = parsed.data;
    const updated = await db.circularRequest.update({ where: { id: req.params.id }, data: { status } });
    await auditLog({ userId: req.user?.id, action: 'CIRCULAR_UPDATE', resource: 'CircularRequest', metadata: { id: req.params.id, status }, req });
    res.json({ data: updated });
  } catch (e) {
    fail(res, 'updateAdminCircularRequest', e);
  }
}

import { Response } from 'express';
import { AuthRequest as Request } from '../middleware/auth';
import db from '../lib/prisma';
import { uploadToCloudinary, getDownloadUrl, deleteFromCloudinary, thumbnailUrl } from '../lib/cloudinary';
import { GARMENT_LIST_COLUMNS } from '../lib/garmentSelect';
import { setPublicCache } from '../lib/httpCache';
import { GarmentCondition, ListingType, EventType } from '@prisma/client';
import { logger } from '../lib/logger';
import { evaluateLifecycle } from '../services/lifecycle.service';
import { ImpactService } from '../services/impact.service';
import { getFeedGarments } from '../services/garment.service';
import { generateGarmentVectorHybrid } from '../services/garmentVector.service';
import { getEstimatedGarmentValue } from '../utils/pricing';
import { InsightService } from '../services/insight.service';
import { cacheGet, cacheSet, cacheWrap, invalidateGarmentCaches } from '../lib/cache';
import { emitBroadcast } from '../lib/socket';

const MAX_PRICE = 10_000_000;
const MAX_IMAGES = 8;
const MAX_ARRAY_ITEMS = 20;
const MAX_ARRAY_ITEM_LEN = 50;
const MAX_LIST_LIMIT = 100;
const LISTING_TYPES = ['SALE', 'RENTAL', 'ACCESSORY_SWAP'];
const GARMENT_CONDITIONS = ['PRISTINE', 'MINOR_WEAR', 'UPCYCLE', 'RECYCLE_ONLY'];
const INTERNAL_GARMENT_FIELDS = ['garmentVector'];

function isIdParam(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64;
}

/** Clamp ?limit= to [1, 100] with a default. */
function clampLimit(raw: unknown, fallback = MAX_LIST_LIMIT): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n)) return Math.min(fallback, MAX_LIST_LIMIT);
  return Math.min(Math.max(Math.floor(n), 1), MAX_LIST_LIMIT);
}

/** Query param that must be a plain string (arrays/objects rejected -> undefined). */
function queryString(v: unknown, max = 100): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/** Trimmed bounded string or undefined. Returns null when value is present but invalid. */
function boundedString(v: unknown, max: number): string | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const t = String(v).trim();
  if (t.length > max) return null;
  return t;
}

/** Parses an optional money field -> integer within [0, MAX_PRICE]; undefined when absent/empty; null when invalid. */
function parseMoney(v: unknown): number | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n);
}

/** Bounded string-array: accepts array or single string. null when invalid. */
function parseStringArray(v: unknown): string[] | undefined | null {
  if (v === undefined || v === null) return undefined;
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? [v] : null;
  if (!arr || arr.length > MAX_ARRAY_ITEMS) return null;
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string' && typeof item !== 'number') return null;
    const s = String(item).trim();
    if (s.length > MAX_ARRAY_ITEM_LEN) return null;
    if (s) out.push(s);
  }
  return out;
}

/** Validates + whitelists user-supplied garment fields (never spreads raw body). */
function validateGarmentFields(
  body: Record<string, unknown>,
  isCreate: boolean
): { error: string } | { f: Record<string, any> } {
  const f: Record<string, any> = {};
  const strFields: Array<[string, number]> = [
    ['title', 100], ['description', 1000], ['brand', 100], ['category', 100], ['subCategory', 100],
    ['size', 30], ['fabric', 100], ['style', 100], ['sleeve', 100], ['shape', 100], ['pattern', 100], ['weight', 50],
  ];
  for (const [k, max] of strFields) {
    const v = boundedString(body[k], max);
    if (v === null) return { error: `${k} is invalid or too long` };
    if (v !== undefined) f[k] = v;
  }
  for (const k of ['color', 'material', 'tags', 'styleTags']) {
    const v = parseStringArray(body[k]);
    if (v === null) return { error: `${k} is invalid (max ${MAX_ARRAY_ITEMS} items, ${MAX_ARRAY_ITEM_LEN} chars each)` };
    if (v !== undefined) f[k] = v;
  }
  for (const k of ['price', 'originalPrice', 'costPrice', 'rentalPriceDay', 'rentalPriceWeek']) {
    const v = parseMoney(body[k]);
    if (v === null) return { error: `${k} must be a number between 0 and ${MAX_PRICE}` };
    if (v !== undefined) f[k] = v;
  }
  if (body.listingType !== undefined && body.listingType !== null) {
    const lt = typeof body.listingType === 'string' ? body.listingType.toUpperCase() : '';
    if (!LISTING_TYPES.includes(lt)) return { error: 'Invalid listingType' };
    f.listingType = lt;
  }
  if (body.condition !== undefined && body.condition !== null) {
    const c = typeof body.condition === 'string' ? body.condition : '';
    if (GARMENT_CONDITIONS.includes(c)) f.condition = c;
    else if (!isCreate) return { error: 'Invalid condition' };
  }
  return { f };
}

function sanitizePublicGarment(g: any, viewerId?: string) {
  if (!g || g.sellerId === viewerId) return g;
  const copy = { ...g };
  for (const f of INTERNAL_GARMENT_FIELDS) delete copy[f];
  return copy;
}

/** Reason a garment cannot be edited/removed because money or ownership is in flight; null when free. */
async function getGarmentLockReason(garment: { id: string; reservedOrderId: string | null; lifecycleState: string }): Promise<string | null> {
  if (garment.reservedOrderId || garment.lifecycleState === 'RESERVED_SALE') return 'Garment is reserved for an order';
  const [order, rental, swap] = await Promise.all([
    db.orderItem.findFirst({
      where: { garmentId: garment.id, order: { status: { in: ['CONFIRMED', 'SHIPPED'] } } },
      select: { id: true },
    }),
    db.rental.findFirst({
      where: { garmentId: garment.id, status: { in: ['APPROVED', 'RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED', 'OVERDUE'] } },
      select: { id: true },
    }),
    db.swap.findFirst({
      where: { status: 'ACCEPTED', OR: [{ garmentOffered: garment.id }, { garmentWanted: garment.id }] },
      select: { id: true },
    }),
  ]);
  if (order) return 'Garment has an order in progress';
  if (rental) return 'Garment has an active rental';
  if (swap) return 'Garment is part of an accepted swap';
  return null;
}

/** Can this viewer see this garment? Public = active & not wardrobe/de-listed; owner & transaction parties always. */
async function canViewGarment(garment: { id: string; sellerId: string; isActive: boolean; lifecycleState: string }, viewerId?: string): Promise<boolean> {
  if (garment.isActive && garment.lifecycleState !== 'OWNERSHIP' && garment.lifecycleState !== 'DECLINE') return true;
  if (!viewerId) return false;
  if (garment.sellerId === viewerId) return true;
  const [order, rental, swap] = await Promise.all([
    db.orderItem.findFirst({ where: { garmentId: garment.id, order: { OR: [{ buyerId: viewerId }, { sellerId: viewerId }] } }, select: { id: true } }),
    db.rental.findFirst({ where: { garmentId: garment.id, renterId: viewerId }, select: { id: true } }),
    db.swap.findFirst({ where: { OR: [{ garmentOffered: garment.id }, { garmentWanted: garment.id }], AND: [{ OR: [{ initiatorId: viewerId }, { receiverId: viewerId }] }] }, select: { id: true } }),
  ]);
  return Boolean(order || rental || swap);
}

/**
 * Helper to resolve all image URLs for a garment (Cloudinary URLs and local fallback)
 */
async function resolveGarmentImages(garment: any) {
  if (!garment || !garment.images) return garment;
  const resolvedImages = await Promise.all(
    garment.images.map((img: string) => getDownloadUrl(img))
  );
  const price = garment.price && garment.price > 0 ? garment.price : getEstimatedGarmentValue(garment.category, garment.brand);
  return { ...garment, price, images: resolvedImages, thumbnailUrl: thumbnailUrl(resolvedImages[0]) };
}

async function resolveGarmentsImages(garments: any[], onlyFirst = false) {
  return Promise.all(garments.map(async (g) => {
    if (!g || !g.images) return g;
    const price = g.price && g.price > 0 ? g.price : getEstimatedGarmentValue(g.category, g.brand);
    if (onlyFirst && g.images.length > 0) {
      const resolved = await getDownloadUrl(g.images[0]);
      // thumbnailUrl is additive: a small f_auto,q_auto copy of the first image for list views.
      return { ...g, price, images: [resolved], thumbnailUrl: thumbnailUrl(resolved) };
    }
    const resolvedImages = await Promise.all(
      g.images.map((img: string) => getDownloadUrl(img))
    );
    return { ...g, price, images: resolvedImages, thumbnailUrl: thumbnailUrl(resolvedImages[0]) };
  }));
}

const SELLER_BRIEF = { select: { id: true, displayName: true } } as const;

export async function searchGarments(req: Request, res: Response): Promise<void> {
  try {
    const q = queryString(req.query.q) || '';
    const payload = await cacheWrap(`garments:search:${req.user?.id || 'anon'}:${q.toLowerCase()}`, 30_000, async () => {
      const garments = await db.garment.findMany({
        where: {
          isActive: true,
          lifecycleState: 'LISTED',
          reservedOrderId: null,
          rentals: {
            none: {
              status: { in: ['RESERVED', 'DISPATCHED', 'ACTIVE'] },
            },
          },
          ...(req.user ? { sellerId: { not: req.user.id } } : {}),
          ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { ...GARMENT_LIST_COLUMNS, seller: SELLER_BRIEF },
      });
      return { data: await resolveGarmentsImages(garments, true) };
    });
    setPublicCache(req, res, 30);
    res.status(200).json(payload);
  } catch (err) {
    logger.error('searchGarments failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function getGarmentFeed(req: Request, res: Response): Promise<void> {
  try {
    const category = queryString(req.query.category, 300);
    const size = queryString(req.query.size, 200);
    const color = queryString(req.query.color, 100);
    const condition = queryString(req.query.condition, 200);
    const listingType = queryString(req.query.listingType, 100);
    const after = queryString(req.query.after, 64);
    const parseNum = (v: unknown): number | undefined => {
      const s = queryString(v, 20);
      if (!s) return undefined;
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE ? n : undefined;
    };
    const priceMin = parseNum(req.query.priceMin);
    const priceMax = parseNum(req.query.priceMax);

    const feedCacheKey = `feed:resolved:${JSON.stringify({ category, size, color, priceMin, priceMax, condition, listingType, after })}:${req.user?.id || 'anon'}`;
    // cacheWrap shares one in-flight query between simultaneous identical requests (cold-start bursts).
    const payload = await cacheWrap(feedCacheKey, 30_000, async () => {
      const result = await getFeedGarments({
        userId: req.user?.id,
        cursor: after || undefined,
        categories: category ? category.split(',').filter(Boolean).slice(0, 20) : undefined,
        sizes: size ? size.split(',').filter(Boolean).slice(0, 20) : undefined,
        colors: color ? [color] : undefined,
        priceMin: priceMin ? priceMin : undefined,
        priceMax: priceMax ? priceMax : undefined,
        condition: condition || undefined,
        listingType: listingType || undefined,
      });

      // Never send the raw style vector to clients (hundreds of floats per garment, unused by the app).
      const items = result.items.map(({ garmentVector: _vector, ...rest }: any) => rest);

      // Resolve image URLs
      const resolvedGarments = await resolveGarmentsImages(items, true);
      return { data: resolvedGarments, pagination: { nextCursor: result.nextCursor } };
    });

    setPublicCache(req, res, 30);
    res.status(200).json(payload);
  } catch (err) {
    logger.error('getGarmentFeed failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function getGarments(req: Request, res: Response): Promise<void> {
  try {
    const limit = clampLimit(req.query.limit, 100);
    const payload = await cacheWrap(`garments:browse:${req.user?.id || 'anon'}:${limit}`, 30_000, async () => {
      const garments = await db.garment.findMany({
        where: {
          isActive: true,
          lifecycleState: 'LISTED',
          reservedOrderId: null,
          rentals: {
            none: {
              status: { in: ['RESERVED', 'DISPATCHED', 'ACTIVE'] },
            },
          },
          ...(req.user ? { sellerId: { not: req.user.id } } : {})
        },
        take: limit,
        select: { ...GARMENT_LIST_COLUMNS, seller: SELLER_BRIEF },
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();
      // Sort: active/available items first, cooldown items placed at the end so users can scroll through everything
      garments.sort((a: any, b: any) => {
        const aCooldown = Boolean(a.cooldownEnd && new Date(a.cooldownEnd) > now);
        const bCooldown = Boolean(b.cooldownEnd && new Date(b.cooldownEnd) > now);
        if (aCooldown === bCooldown) return 0;
        return aCooldown ? 1 : -1;
      });

      return { data: await resolveGarmentsImages(garments, true) };
    });
    setPublicCache(req, res, 30);
    res.status(200).json(payload);
  } catch (err) {
    logger.error('getGarments failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function getSellerGarments(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const limit = clampLimit(req.query.limit, 100);
    const pageRaw = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 1000) : 1;
    const garments = await db.garment.findMany({
      where: { sellerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: { ...GARMENT_LIST_COLUMNS, seller: SELLER_BRIEF }
    });
    const resolvedGarments = await resolveGarmentsImages(garments, true);
    res.status(200).json({ data: resolvedGarments });
  } catch (err) {
    logger.error('getSellerGarments failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function getWishlistGarments(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    // Get all WISHLIST events for this user
    const events = await db.behaviourEvent.findMany({
      where: {
        userId: req.user.id,
        eventType: EventType.WISHLIST
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_LIMIT,
      select: { garmentId: true }
    });

    const garmentIds = events.map((e: { garmentId: string | null }) => e.garmentId).filter((x: string | null): x is string => Boolean(x));

    if (garmentIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const garments = await db.garment.findMany({
      where: {
        id: { in: garmentIds },
        isActive: true
      },
      take: MAX_LIST_LIMIT,
      select: {
        ...GARMENT_LIST_COLUMNS,
        seller: { select: { id: true, displayName: true, username: true } }
      }
    });

    const resolvedGarments = await resolveGarmentsImages(garments, true);
    res.status(200).json({ data: resolvedGarments });
  } catch (err) {
    logger.error('getWishlistGarments failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}


export async function getGarmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    // The view counter is a statistic, not part of the response: never make the reader wait for it.
    const bumpViewCount = () =>
      db.garment
        .update({ where: { id }, data: { viewCount: { increment: 1 } }, select: { id: true } })
        .catch((e: Error) => logger.warn('viewCount increment failed', { error: e.message }));

    // Anonymous viewers of a public garment all get the same body: serve it from cache for a short time.
    const anonKey = `garments:detail:${id}`;
    if (!req.user) {
      const cachedDetail = cacheGet<any>(anonKey);
      if (cachedDetail) {
        setPublicCache(req, res, 30);
        void bumpViewCount();
        res.status(200).json(cachedDetail);
        return;
      }
    }

    const garment = await db.garment.findFirst({
      where: { id },
      select: {
        ...GARMENT_LIST_COLUMNS,
        seller: { select: { id: true, displayName: true, username: true, avatar: true } },
        reviews: { select: { id: true, userId: true, rating: true, comment: true, createdAt: true }, take: MAX_LIST_LIMIT, orderBy: { createdAt: 'desc' } }
      },
    });
    if (!garment || !(await canViewGarment(garment, req.user?.id))) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }

    // Fire-and-forget: view counter + VIEW event + lifecycle evaluation
    void bumpViewCount();
    if (req.user && req.user.id !== garment.sellerId) {
      db.behaviourEvent
        .create({ data: { garmentId: id, userId: req.user.id, eventType: EventType.VIEW }, select: { id: true } })
        .catch((e: Error) => logger.warn('VIEW event failed', { error: e.message }));
      evaluateLifecycle(id, req.user.id, EventType.VIEW).catch((e: Error) => logger.error('LOE failed on view', { error: e.message }));
    }

    // Wishlist check and image URL resolution are independent: run them together
    const [wishlisted, resolvedGarment] = await Promise.all([
      req.user
        ? db.behaviourEvent.findFirst({
            where: { userId: req.user.id, garmentId: id, eventType: EventType.WISHLIST },
            select: { id: true },
          })
        : Promise.resolve(null),
      resolveGarmentImages(sanitizePublicGarment(garment, req.user?.id)),
    ]);
    const isLiked = req.user ? !!wishlisted : false;

    const body = { data: { ...resolvedGarment, isLiked } };
    // Only cache what any anonymous visitor is allowed to see (never owner-only / hidden garments)
    if (!req.user && garment.isActive && garment.lifecycleState !== 'OWNERSHIP' && garment.lifecycleState !== 'DECLINE') {
      cacheSet(anonKey, body, 30_000);
      setPublicCache(req, res, 30);
    }
    res.status(200).json(body);
  } catch (err) {
    logger.error('getGarmentById failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function createGarment(req: Request, res: Response): Promise<void> {
  const imageUrls: string[] = [];
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const validated = validateGarmentFields(body, true);
    if ('error' in validated) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: validated.error, statusCode: 400 });
      return;
    }
    const f = validated.f;
    if (!f.title || !f.description || !f.category || !f.size) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title, description, category and size are required', statusCode: 400 });
      return;
    }
    if (Array.isArray(req.files) && req.files.length > MAX_IMAGES) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `At most ${MAX_IMAGES} images allowed`, statusCode: 400 });
      return;
    }
    const title: string = f.title;
    const brand: string = f.brand || 'Unknown';

    // Duplicate prevention: check if this user listed the exact same item within the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const existingRecent = await db.garment.findFirst({
      where: {
        sellerId: req.user.id,
        title,
        brand,
        createdAt: { gte: oneMinuteAgo },
      },
      select: GARMENT_LIST_COLUMNS,
    });
    if (existingRecent) {
      logger.info('Duplicate garment listing intercepted within 60s window', { garmentId: existingRecent.id });
      const resolvedGarment = await resolveGarmentImages(existingRecent);
      res.status(200).json({ data: resolvedGarment, message: 'Garment already listed' });
      return;
    }

    const listingType: string = f.listingType || 'SALE';
    const category: string = f.category;
    const subCategory: string = f.subCategory || '';

    if (listingType === 'ACCESSORY_SWAP') {
      const accessoryTerms = [
        'accessory', 'accessories', 'bag', 'bags', 'jewelry', 'jewellery',
        'watch', 'watches', 'eyewear', 'belt', 'belts', 'hat', 'hats',
        'scarf', 'scarves', 'wallet', 'wallets', 'tie', 'ties',
        'footwear', 'shoes', 'sneakers', 'heels', 'boots', 'sandals'
      ];
      const catLower = category.toLowerCase();
      const subLower = subCategory.toLowerCase();
      const isAcc = accessoryTerms.some(term => catLower.includes(term) || subLower.includes(term)) ||
        body.isAccessory === true || body.isAccessory === 'true';
      if (!isAcc) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Only accessories (bags, jewelry, watches, eyewear, belts, hats, scarves, wallets, ties, footwear) are eligible for swap listings.',
          statusCode: 400,
        });
        return;
      }
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (files?.length) {
      // Parallelize image uploads for maximum performance
      const uploadResults = await Promise.all(
        files.map(file => uploadToCloudinary(file.buffer, 'garments', file.mimetype))
      );
      for (const res of uploadResults) {
        imageUrls.push(res.url);
      }
    }
    const condition: string = f.condition || 'PRISTINE';

    // Auto-match material impact (runs while the style vector is being generated)
    const materialIdPromise = ImpactService.findMatchingMaterialId(
      title,
      category,
      f.fabric || null
    );
    materialIdPromise.catch(() => {}); // avoid an unhandled rejection if the vector step throws first

    // Generate style vector with 3.5s timeout so slow external AI calls don't block listing
    let garmentVector: number[] = [];
    if (
      Array.isArray(body.garmentVector) &&
      body.garmentVector.length > 0 &&
      body.garmentVector.length <= 512 &&
      body.garmentVector.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))
    ) {
      garmentVector = body.garmentVector as number[];
    } else {
      try {
        const vectorPromise = generateGarmentVectorHybrid(
          imageUrls[0] || null,
          {
            category: f.category || undefined,
            subCategory: f.subCategory || undefined,
            style: f.style || undefined,
            color: f.color,
            fabric: f.fabric || undefined,
            pattern: f.pattern || undefined,
            sleeve: f.sleeve || undefined,
            shape: f.shape || undefined,
            tags: f.tags,
            styleTags: f.styleTags,
          }
        );
        const timeoutPromise = new Promise<{ vector: number[] }>((_, reject) =>
          setTimeout(() => reject(new Error('Vector generation timeout')), 3500)
        );
        const result = await Promise.race([vectorPromise, timeoutPromise]);
        garmentVector = result.vector;
      } catch (vecErr) {
        logger.warn('Garment vector generation timed out or failed; proceeding with fallback', {
          error: (vecErr as any)?.message,
        });
        garmentVector = [];
      }
    }

    const materialId = await materialIdPromise;

    // Create garment transaction
    const garment = await (db as any).$transaction(async (tx: any) => {
      const g = await tx.garment.create({
        data: {
          sellerId: req.user!.id,
          title,
          description: f.description,
          brand,
          category,
          subCategory: f.subCategory || null,
          size: f.size,
          color: f.color || [],
          material: f.material || [],
          condition: condition as GarmentCondition,
          images: imageUrls,
          fabric: f.fabric || null,
          style: f.style || null,
          sleeve: f.sleeve || null,
          shape: f.shape || null,
          pattern: f.pattern || null,
          weight: f.weight || null,
          materialId,
          tags: f.tags || [],
          styleTags: f.styleTags || [],
          garmentVector,
          lifecycleState: 'LISTED',
          listingType: listingType as ListingType,
          price: listingType === 'ACCESSORY_SWAP'
            ? (f.price > 0 ? f.price : 0)
            : (f.price > 0 ? f.price : getEstimatedGarmentValue(category, brand === 'Unknown' ? '' : brand)),
          originalPrice: f.originalPrice > 0
            ? f.originalPrice
            : (f.costPrice > 0 ? f.costPrice : null),
          rentalPriceDay: f.rentalPriceDay ?? null,
          rentalPriceWeek: f.rentalPriceWeek ?? null,
        },
        select: GARMENT_LIST_COLUMNS,
      });

      // Initialize initial behaviour signal for the seller
      await tx.behaviourSignal.create({
        data: {
          userId: req.user!.id,
          garmentId: g.id,
          interestScore: 1.0, // Seller has high initial interest
        }
      });
      return g;
    });

    invalidateGarmentCaches();
    const resolvedGarment = await resolveGarmentImages(garment);
    res.status(201).json({ data: resolvedGarment });
  } catch (err) {
    if (imageUrls.length > 0) {
      for (const url of imageUrls) {
        deleteFromCloudinary(url).catch(() => {});
      }
    }
    logger.error('createGarment failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create garment', statusCode: 500 });
  }
}

export async function updateGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const existing = await db.garment.findFirst({ where: { id, sellerId: req.user.id }, select: GARMENT_LIST_COLUMNS });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const validated = validateGarmentFields(body, false);
    if ('error' in validated) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: validated.error, statusCode: 400 });
      return;
    }
    const f = validated.f;

    // Escrow protection: no pricing / listing / visibility / image changes while money or ownership is in flight
    const differs = (next: unknown, cur: unknown) => next !== undefined && next !== (cur ?? undefined);
    const imagesDiffer =
      Array.isArray(body.images) &&
      (body.images.length !== existing.images.length || body.images.some((i: unknown) => !existing.images.includes(String(i))));
    const touchesProtected =
      differs(f.price, existing.price) || differs(f.rentalPriceDay, existing.rentalPriceDay) ||
      differs(f.rentalPriceWeek, existing.rentalPriceWeek) || differs(f.listingType, existing.listingType) ||
      (body.isActive != null && Boolean(body.isActive) !== existing.isActive) ||
      imagesDiffer || (Array.isArray(req.files) && req.files.length > 0);
    if (touchesProtected) {
      const lock = await getGarmentLockReason(existing);
      if (lock) {
        res.status(409).json({ error: 'CONFLICT', message: `${lock}; this change is not allowed right now`, statusCode: 409 });
        return;
      }
    }
    if (existing.lifecycleState === 'DECLINE' || existing.lifecycleState === 'OWNERSHIP') {
      // De-listed / wardrobe items cannot be silently re-activated or re-priced via edit
      if (body.isActive != null && Boolean(body.isActive) === true) {
        res.status(409).json({ error: 'CONFLICT', message: 'Use relist to list this garment again', statusCode: 409 });
        return;
      }
    }

    const newListingType = f.listingType || existing.listingType;
    const newCategory = f.category || existing.category;
    const newSubCategory = f.subCategory || existing.subCategory;
    if (newListingType === 'ACCESSORY_SWAP') {
      const accessoryTerms = [
        'accessory', 'accessories', 'bag', 'bags', 'jewelry', 'jewellery',
        'watch', 'watches', 'eyewear', 'belt', 'belts', 'hat', 'hats',
        'scarf', 'scarves', 'wallet', 'wallets', 'tie', 'ties',
        'footwear', 'shoes', 'sneakers', 'heels', 'boots', 'sandals'
      ];
      const catLower = (newCategory || '').toLowerCase();
      const subLower = (newSubCategory || '').toLowerCase();
      const isAcc = accessoryTerms.some(term => catLower.includes(term) || subLower.includes(term));
      if (!isAcc) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Only accessories (bags, jewelry, watches, eyewear, belts, hats, scarves, wallets, ties, footwear) are eligible for swap listings.',
          statusCode: 400,
        });
        return;
      }
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const newImageUrls: string[] = [];
    {
      const keptCount = Array.isArray(body.images)
        ? (body.images as unknown[]).filter((i) => typeof i === 'string' && existing.images.includes(i)).length
        : existing.images.length;
      if (body.images !== undefined && !Array.isArray(body.images)) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'images must be an array', statusCode: 400 });
        return;
      }
      if (keptCount + (files?.length || 0) > MAX_IMAGES) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: `At most ${MAX_IMAGES} images allowed`, statusCode: 400 });
        return;
      }
    }
    if (files?.length) {
      // Upload all new photos concurrently (was one after another)
      const uploaded = await Promise.all(files.map((file) => uploadToCloudinary(file.buffer, 'garments', file.mimetype)));
      for (const r of uploaded) newImageUrls.push(r.url);
    }

    // If new images are uploaded, we typically replace or append.
    // Here we'll take existing images from body (if provided) and append new ones.
    let updatedImages = existing.images || [];
    if (body.images && Array.isArray(body.images)) {
      // Only allow keeping images this garment already owns (clients cannot inject arbitrary URLs/keys)
      const kept = new Set((body.images as unknown[]).filter((i): i is string => typeof i === 'string'));
      const removed = existing.images.filter((img: string) => !kept.has(img));
      for (const img of removed) {
        deleteFromCloudinary(img).catch((delErr) => logger.warn('Failed to prune replaced image', { img, error: delErr }));
      }
      updatedImages = existing.images.filter((img: string) => kept.has(img));
    }
    if (newImageUrls.length > 0) {
      updatedImages = [...updatedImages, ...newImageUrls];
    }

    // Regenerate vector if relevant attributes changed or new images uploaded
    const attrsChanged = f.category || f.style || f.color || f.fabric || f.pattern;
    const imagesChanged = newImageUrls.length > 0;
    const updatedVector = (attrsChanged || imagesChanged)
      ? (await generateGarmentVectorHybrid(
          newImageUrls[0] || updatedImages[0] || null,
          {
            category: f.category || existing.category,
            subCategory: f.subCategory || existing.subCategory || undefined,
            style: f.style || existing.style || undefined,
            color: f.color || existing.color,
            fabric: f.fabric || existing.fabric || undefined,
            pattern: f.pattern || existing.pattern || undefined,
          }
        )).vector
      : undefined;

    const garment = await db.garment.update({
      where: { id },
      data: {
        ...(f.title !== undefined && { title: f.title }),
        ...(f.description !== undefined && { description: f.description }),
        ...(f.brand !== undefined && { brand: f.brand }),
        ...(f.category !== undefined && { category: f.category }),
        ...(f.subCategory !== undefined && { subCategory: f.subCategory }),
        ...(f.size !== undefined && { size: f.size }),
        ...(f.color !== undefined && { color: f.color }),
        ...(f.material !== undefined && { material: f.material }),
        ...(f.tags !== undefined && { tags: f.tags }),
        ...(f.styleTags !== undefined && { styleTags: f.styleTags }),
        ...(f.price !== undefined && {
          price: newListingType === 'ACCESSORY_SWAP' ? f.price : f.price > 0 ? f.price : existing.price ?? 0,
        }),
        ...((f.originalPrice !== undefined || f.costPrice !== undefined) && {
          originalPrice: f.originalPrice > 0
            ? f.originalPrice
            : (f.costPrice > 0 ? f.costPrice : null),
        }),
        ...(f.rentalPriceDay !== undefined && { rentalPriceDay: f.rentalPriceDay }),
        ...(f.rentalPriceWeek !== undefined && { rentalPriceWeek: f.rentalPriceWeek }),
        ...(f.listingType !== undefined && { listingType: f.listingType as ListingType }),
        ...(f.condition !== undefined && { condition: f.condition as GarmentCondition }),
        ...(body.isActive != null && { isActive: Boolean(body.isActive) }),
        ...(f.fabric !== undefined && { fabric: f.fabric }),
        ...(f.style !== undefined && { style: f.style }),
        ...(f.sleeve !== undefined && { sleeve: f.sleeve }),
        ...(f.shape !== undefined && { shape: f.shape }),
        ...(f.pattern !== undefined && { pattern: f.pattern }),
        ...(f.weight !== undefined && { weight: f.weight }),
        ...(updatedVector && { garmentVector: updatedVector }),
        images: updatedImages,
      },
      select: GARMENT_LIST_COLUMNS,
    });
    invalidateGarmentCaches();
    const resolvedGarment = await resolveGarmentImages(garment);
    res.status(200).json({ data: resolvedGarment });
  } catch (err) {
    logger.error('updateGarment failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update garment', statusCode: 500 });
  }
}

export async function deleteGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const whereClause: any = { id };
    if (req.user.role !== 'ADMIN') {
      whereClause.sellerId = req.user.id;
    }
    const existing = await db.garment.findFirst({
      where: whereClause,
      include: {
        orderItems: { select: { id: true }, take: 1 },
        rentals: { select: { id: true }, take: 1 },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const lock = await getGarmentLockReason(existing);
    if (lock) {
      res.status(409).json({ error: 'CONFLICT', message: `${lock}; it cannot be removed right now`, statusCode: 409 });
      return;
    }

    // Prune storage if this unsold/unrented garment is deleted
    const hasHistory = (existing.orderItems && existing.orderItems.length > 0) || (existing.rentals && existing.rentals.length > 0);
    if (!hasHistory && Array.isArray(existing.images)) {
      for (const img of existing.images) {
        deleteFromCloudinary(img).catch((delErr: any) => logger.warn('Failed to prune image on garment deletion', { img, error: delErr }));
      }
    }

    // Atomic guard: do not de-list if it got reserved in the meantime
    const delisted = await db.garment.updateMany({
      where: { id, reservedOrderId: null, lifecycleState: { not: 'RESERVED_SALE' } },
      data: {
        isActive: false,
        lifecycleState: 'DECLINE',
      },
    });
    if (delisted.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Garment is reserved; it cannot be removed right now', statusCode: 409 });
      return;
    }
    invalidateGarmentCaches();
    emitBroadcast('garment:delisted', { garmentId: id, action: 'delete' });
    res.status(200).json({ data: { message: 'Garment de-listed successfully' } });
  } catch (err) {
    logger.error('deleteGarment failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to remove garment', statusCode: 500 });
  }
}

export async function pauseGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const whereClause: any = { id };
    if (req.user.role !== 'ADMIN') {
      whereClause.sellerId = req.user.id;
    }
    const existing = await db.garment.findFirst({ where: whereClause });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    // Only live listings can be paused/resumed; reserved / wardrobe / de-listed items cannot be toggled
    if (
      existing.reservedOrderId ||
      existing.lifecycleState === 'RESERVED_SALE' ||
      existing.lifecycleState === 'OWNERSHIP' ||
      existing.lifecycleState === 'DECLINE'
    ) {
      res.status(409).json({ error: 'CONFLICT', message: 'This garment cannot be paused or resumed in its current state', statusCode: 409 });
      return;
    }

    const nextActive = !existing.isActive;
    const updated = await db.garment.update({
      where: { id },
      data: {
        isActive: nextActive,
      },
    });

    invalidateGarmentCaches();
    if (!nextActive) {
      emitBroadcast('garment:delisted', { garmentId: id, action: 'pause' });
    } else {
      emitBroadcast('garment:listed', { garmentId: id, action: 'resume' });
    }

    res.status(200).json({
      data: {
        id: updated.id,
        isActive: updated.isActive,
        message: nextActive ? 'Listing resumed successfully' : 'Listing paused successfully'
      }
    });
  } catch (err) {
    logger.error('pauseGarment failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update garment', statusCode: 500 });
  }
}

export async function moveGarmentToWardrobe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const whereClause: any = { id };
    if (req.user.role !== 'ADMIN') {
      whereClause.sellerId = req.user.id;
    }
    const existing = await db.garment.findFirst({ where: whereClause });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const lock = await getGarmentLockReason(existing);
    if (lock) {
      res.status(409).json({ error: 'CONFLICT', message: `${lock}; it cannot be moved right now`, statusCode: 409 });
      return;
    }

    const moved = await db.garment.updateMany({
      where: { id, reservedOrderId: null, lifecycleState: { not: 'RESERVED_SALE' } },
      data: {
        isActive: false,
        lifecycleState: 'OWNERSHIP',
      },
    });
    if (moved.count === 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Garment is reserved; it cannot be moved right now', statusCode: 409 });
      return;
    }
    const updated = { id };

    invalidateGarmentCaches();
    emitBroadcast('garment:delisted', { garmentId: id, action: 'wardrobe' });

    res.status(200).json({
      data: {
        id: updated.id,
        isActive: false,
        lifecycleState: 'OWNERSHIP',
        message: 'Garment moved back to your wardrobe successfully'
      }
    });
  } catch (err) {
    logger.error('moveGarmentToWardrobe failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update garment', statusCode: 500 });
  }
}

export async function getGarmentLifecycle(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const garment = await db.garment.findFirst({
      where: { id },
      select: { id: true, sellerId: true, isActive: true, lifecycleState: true, createdAt: true, updatedAt: true },
    });
    if (!garment || !(await canViewGarment(garment, req.user?.id))) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: { state: garment.lifecycleState, createdAt: garment.createdAt, updatedAt: garment.updatedAt } });
  } catch (err) {
    logger.error('getGarmentLifecycle failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 });
  }
}

export async function getCompatibilityScore(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const garment = await db.garment.findFirst({
      where: { id },
      select: { id: true, sellerId: true, isActive: true, lifecycleState: true },
    });
    if (!garment || !(await canViewGarment(garment, req.user?.id))) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: { garmentId: id, score: 0.85 } });
  } catch (err) {
    logger.error('getCompatibilityScore failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 });
  }
}

/**
 * GET /garments/:id/insights
 * Returns deep telemetry insights, funnels, 7-day trend, and AI advice for the seller.
 */
export async function getGarmentInsights(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }

    const { id } = req.params;
    if (!isIdParam(id)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const insights = await InsightService.getGarmentDetailedInsights(id, req.user.id);

    if (!insights) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Garment not found or you do not have permission to view seller insights for this asset.',
        statusCode: 404,
      });
      return;
    }

    // Resolve thumbnail if present
    if (insights.thumbnail) {
      insights.thumbnail = await getDownloadUrl(insights.thumbnail);
    }

    res.status(200).json({ data: insights });
  } catch (err) {
    logger.error('getGarmentInsights failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve garment insights' });
  }
}


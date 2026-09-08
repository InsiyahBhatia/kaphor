import db from '../lib/prisma';
import { computeFitScore } from './scoring.service';
import { GarmentCondition, ListingType } from '@prisma/client';
import { cacheGet, cacheSet } from '../lib/cache';

const DEFAULT_FEED_LIMIT = 20;

interface FeedParams {
  userId?: string;
  cursor?: string;
  categories?: string[];
  sizes?: string[];
  colors?: string[];
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  listingType?: string;
  limit?: number;
}

export async function getFeedGarments(params: FeedParams) {
  const cacheKey = `feed:${JSON.stringify(params)}`;
  const cached = cacheGet<{ items: any[]; nextCursor: string | null }>(cacheKey);
  if (cached) return cached;

  const limit = params.limit ?? DEFAULT_FEED_LIMIT;
  const where: Record<string, unknown> = { isActive: true };

  if (params.categories && params.categories.length > 0) {
    where.OR = [
      { category: { in: params.categories } },
      { subCategory: { in: params.categories } },
    ];
  }

  if (params.sizes && params.sizes.length > 0) {
    where.size = { in: params.sizes };
  }

  if (params.colors && params.colors.length > 0) {
    where.color = { hasSome: params.colors };
  }

  if (params.condition) {
    const conditions = params.condition.split(',').filter(Boolean) as GarmentCondition[];
    if (conditions.length > 0) {
      where.condition = { in: conditions };
    }
  }

  if (params.listingType) {
    const validTypes: ListingType[] = ['SALE', 'RENTAL', 'ACCESSORY_SWAP'];
    const types = params.listingType
      .split(',')
      .filter((t) => validTypes.includes(t as ListingType)) as ListingType[];
    if (types.length > 0) {
      where.listingType = { in: types };
    }
  }

  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (params.priceMin !== undefined) {
      priceFilter.gte = Math.round(Number(params.priceMin) * 100);
    }
    if (params.priceMax !== undefined) {
      priceFilter.lte = Math.round(Number(params.priceMax) * 100);
    }
    where.price = priceFilter;
  }

  const garments = await db.garment.findMany({
    where,
    take: limit + 1,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    skip: params.cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      price: true,
      images: true,
      brand: true,
      category: true,
      subCategory: true,
      size: true,
      condition: true,
      fabric: true,
      style: true,
      pattern: true,
      listingType: true,
      garmentVector: true,
      seller: { select: { id: true, displayName: true, avatar: true } },
    },
  });

  let userStyleVector: number[] | null = null;
  if (params.userId) {
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { styleVector: true },
    });
    userStyleVector = user?.styleVector ?? null;
  }

  let results = garments.map((g: any) => {
    let fitScore = 0;
    if (userStyleVector && g.garmentVector && g.garmentVector.length > 0) {
      fitScore = computeFitScore(userStyleVector, g.garmentVector);
    }
    return { ...g, fitScore };
  });

  if (userStyleVector) {
    results.sort((a: any, b: any) => b.fitScore - a.fitScore);
  }

  const hasNextPage = results.length > limit;
  if (hasNextPage) {
    results = results.slice(0, limit);
  }

  const nextCursor = hasNextPage && results.length > 0 ? results[results.length - 1].id : null;

  return { items: results, nextCursor };
}

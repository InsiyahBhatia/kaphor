import { Request, Response } from 'express';
import db from '../lib/prisma';
import { uploadImage } from '../lib/cloudinary';
import { GarmentCondition, ListingType, EventType } from '@prisma/client';
import { logger } from '../lib/logger';
import { evaluateLifecycle } from '../services/lifecycle.service';

const DEFAULT_VECTOR = Array(16).fill(0);

export async function searchGarments(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string) || '';
    const garments = await db.garment.findMany({
      where: {
        isActive: true,
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      take: 20,
      include: { seller: { select: { id: true, displayName: true } } },
    });
    res.status(200).json({ data: garments });
  } catch (err) {
    logger.error('searchGarments failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getGarmentFeed(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const { category, size, color, priceMin, priceMax, condition, listingType, after } = req.query;
    const limit = 20;

    const whereClause: any = { isActive: true };
    if (category) whereClause.category = String(category);
    if (size) whereClause.size = String(size);
    if (color) whereClause.color = { has: String(color) };
    if (condition) whereClause.condition = String(condition) as GarmentCondition;
    if (listingType) whereClause.listingType = String(listingType) as ListingType;
    if (priceMin || priceMax) {
      whereClause.price = {};
      if (priceMin) whereClause.price.gte = Math.round(Number(priceMin) * 100);
      if (priceMax) whereClause.price.lte = Math.round(Number(priceMax) * 100);
    }

    const garments = await db.garment.findMany({
      where: whereClause,
      take: limit + 1,
      cursor: after ? { id: String(after) } : undefined,
      skip: after ? 1 : 0,
      include: { seller: { select: { id: true, displayName: true, username: true } } },
    });

    let hasNextPage = false;
    if (garments.length > limit) {
      hasNextPage = true;
      garments.pop();
    }

    // Proxy for compatibility score in feed (ideal relies on vector db or LOE scoring pre-fetch)
    // Here we compute a basic "fitScore" on the fly for demonstration.
    const user = await db.user.findUnique({ where: { id: req.user.id } });
    const scoredGarments = garments.map((g: any) => {
      let fitScore = 0;
      if (user && user.styleVector.length && g.garmentVector.length) {
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < Math.min(user.styleVector.length, g.garmentVector.length); i++) {
          dot += user.styleVector[i] * g.garmentVector[i];
          magA += user.styleVector[i] ** 2;
          magB += g.garmentVector[i] ** 2;
        }
        fitScore = dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
      }
      return { ...g, fitScore, conditionLabel: g.condition };
    });

    // sorting by fitScore descending
    scoredGarments.sort((a: any, b: any) => b.fitScore - a.fitScore);

    const nextCursor = hasNextPage ? garments[garments.length - 1].id : null;
    res.status(200).json({ data: scoredGarments, pagination: { nextCursor } });
  } catch (err) {
    logger.error('getGarmentFeed failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function getGarments(req: Request, res: Response): Promise<void> {
  try {
    const garments = await db.garment.findMany({
      where: { isActive: true },
      take: 50,
      include: { seller: { select: { id: true, displayName: true } } },
    });
    res.status(200).json({ data: garments });
  } catch (err) {
    logger.error('getGarments failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getSellerGarments(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    const garments = await db.garment.findMany({
      where: { sellerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { seller: { select: { id: true, displayName: true } } }
    });
    res.status(200).json({ data: garments });
  } catch (err) {
    logger.error('getSellerGarments failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export async function getGarmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const garment = await db.garment.findUnique({
      where: { id, isActive: true },
      include: {
        seller: { select: { id: true, displayName: true, username: true, avatar: true } },
        reviews: true
      },
    });
    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }

    // Increment viewCount and record event if authenticated
    await db.garment.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    if (req.user && req.user.id !== garment.sellerId) {
      await db.behaviourEvent.create({
        data: {
          garmentId: id,
          userId: req.user.id,
          eventType: EventType.VIEW
        }
      });
      // Optionally run LOE asynchronously
      evaluateLifecycle(id, req.user.id, EventType.VIEW).catch((e: Error) => logger.error('LOE failed on view', { error: e.message }));
    }

    res.status(200).json({ data: garment });
  } catch (err) {
    logger.error('getGarmentById failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function createGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const files = req.files as Express.Multer.File[] | undefined;
    const imageUrls: string[] = [];
    if (files?.length) {
      for (const file of files) {
        const result = await uploadImage(file.buffer, 'garments');
        imageUrls.push(result.url);
      }
    }
    const body = req.body as Record<string, unknown>;
    const condition = (body.condition as string) || 'PRISTINE';

    // Create garment transaction
    const garment = await (db as any).$transaction(async (tx: any) => {
      const g = await tx.garment.create({
        data: {
          sellerId: req.user!.id,
          title: String(body.title),
          description: String(body.description),
          brand: String(body.brand || 'Unknown'),
          category: String(body.category),
          subCategory: body.subCategory ? String(body.subCategory) : null,
          size: String(body.size),
          color: Array.isArray(body.color) ? body.color.map(String) : typeof body.color === 'string' ? [body.color] : [],
          material: Array.isArray(body.material) ? body.material.map(String) : [],
          condition: condition in GarmentCondition ? (condition as GarmentCondition) : 'PRISTINE',
          images: imageUrls,
          tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
          styleTags: Array.isArray(body.styleTags) ? body.styleTags.map(String) : [],
          garmentVector: Array.isArray(body.garmentVector) ? (body.garmentVector as number[]) : DEFAULT_VECTOR,
          lifecycleState: 'LISTED',
          listingType: (body.listingType as ListingType) || 'SALE',
          price: body.price != null ? Math.round(Number(body.price) * 100) : null,
          rentalPriceDay: body.rentalPriceDay != null ? Math.round(Number(body.rentalPriceDay) * 100) : null,
          rentalPriceWeek: body.rentalPriceWeek != null ? Math.round(Number(body.rentalPriceWeek) * 100) : null,
        },
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

    res.status(201).json({ data: garment });
  } catch (err) {
    logger.error('createGarment failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function updateGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const { id } = req.params;
    const existing = await db.garment.findFirst({ where: { id, sellerId: req.user.id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const garment = await db.garment.update({
      where: { id },
      data: {
        ...(body.title != null && { title: String(body.title) }),
        ...(body.description != null && { description: String(body.description) }),
        ...(body.category != null && { category: String(body.category) }),
        ...(body.size != null && { size: String(body.size) }),
        ...(body.price != null && { price: Math.round(Number(body.price) * 100) }),
      },
    });
    res.status(200).json({ data: garment });
  } catch (err) {
    logger.error('updateGarment failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function deleteGarment(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 });
      return;
    }
    const { id } = req.params;
    const existing = await db.garment.findFirst({ where: { id, sellerId: req.user.id } });
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    await db.garment.update({ where: { id }, data: { isActive: false } });
    res.status(200).json({ data: { message: 'Garment deleted' } });
  } catch (err) {
    logger.error('deleteGarment failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getGarmentLifecycle(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const garment = await db.garment.findFirst({
      where: { id },
      select: { id: true, lifecycleState: true, createdAt: true, updatedAt: true },
    });
    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: { state: garment.lifecycleState, createdAt: garment.createdAt, updatedAt: garment.updatedAt } });
  } catch (err) {
    logger.error('getGarmentLifecycle failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getCompatibilityScore(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const garment = await db.garment.findFirst({
      where: { id },
      select: { id: true, garmentVector: true },
    });
    if (!garment) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Garment not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: { garmentId: id, score: 0.85 } });
  } catch (err) {
    logger.error('getCompatibilityScore failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

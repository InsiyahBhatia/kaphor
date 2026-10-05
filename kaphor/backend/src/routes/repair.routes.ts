import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { authenticate } from '../middleware/auth';
import { assessRepair, lookupRepairFromAssessment } from '../services/repair.service';

const router = Router();

const GARMENT_CATEGORIES = [
  'top', 'tshirt', 'shirt', 'blouse', 'kurta', 'kurti', 'saree', 'lehenga',
  'dress', 'skirt', 'trousers', 'jeans', 'shorts',
  'jacket', 'blazer', 'coat', 'sweater', 'hoodie', 'sweatshirt',
  'activewear', 'other',
] as const;

/** About 10 MB of base64 text */
const MAX_IMAGE_BASE64_CHARS = 10 * 1024 * 1024;

const shortText = (max: number) => z.string().trim().max(max);

/** Optional field that also accepts null (returned as undefined). */
const opt = <T extends z.ZodTypeAny>(schema: T) => schema.nullish().transform((v) => v ?? undefined);

/** Unknown categories from the photo scan become 'other' instead of failing. */
const categorySchema = z
  .string()
  .trim()
  .max(40)
  .transform((v): (typeof GARMENT_CATEGORIES)[number] => {
    const c = v.toLowerCase();
    return (GARMENT_CATEGORIES as readonly string[]).includes(c) ? (c as (typeof GARMENT_CATEGORIES)[number]) : "other";
  });

const lookupSchema = z
  .object({
    garment_category: opt(categorySchema),
    fiber_type: opt(shortText(60)),
    damage_types: opt(z.array(shortText(60)).max(20)),
    damage_description: opt(shortText(1000)),
    repair_feasibility: opt(shortText(500)),
    condition_score: opt(z.number().min(0).max(1)),
    routing_decision: opt(z.enum(['RESELL', 'UPCYCLE', 'RECYCLE'])),
    original_price_inr: opt(z.number().min(0).max(10_000_000)),
  })
  .refine((v) => !!v.garment_category || !!v.fiber_type, {
    message: 'garment_category or fiber_type is required',
  });

const assessSchema = z.object({
  image_base64: opt(z.string().max(MAX_IMAGE_BASE64_CHARS)),
  garment_category: opt(categorySchema),
  fiber_type: opt(shortText(60)),
  original_price_inr: opt(z.number().min(0).max(10_000_000)),
  style_tags: opt(shortText(200)),
  color_family: opt(shortText(60)),
  season: opt(shortText(60)),
  damage_description: opt(shortText(1000)),
  damage_types: opt(z.array(shortText(60)).max(20)),
  repair_feasibility: opt(shortText(500)),
  condition_score: opt(z.number().min(0).max(1)),
  // Sent by the condition check screen. Accepted and ignored here.
  garment_id: opt(shortText(100)),
});

/**
 * POST /api/v1/repair/lookup
 *
 * Fast lookup from an assessment the app already has. No image upload and no
 * vision call. Returns YouTube tutorials and blog posts for repair and upcycle.
 */
router.post('/lookup', authenticate, async (req: Request, res: Response) => {
  const parsed = lookupSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  try {
    const input = parsed.data;
    const result = await lookupRepairFromAssessment({
      garment_category: input.garment_category ?? 'other',
      fiber_type: input.fiber_type ?? '',
      damage_types: input.damage_types,
      damage_description: input.damage_description,
      repair_feasibility: input.repair_feasibility,
      condition_score: input.condition_score,
      routing_decision: input.routing_decision,
      original_price_inr: input.original_price_inr,
    });
    res.json({ data: result });
  } catch (e: any) {
    logger.error('[Repair] Lookup failed', { error: e?.message });
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/v1/repair/assess
 *
 * Full assessment. Scores the garment photo when one is sent, then returns
 * repair and upcycle tutorials. Without a photo it works like /lookup.
 */
router.post('/assess', authenticate, async (req: Request, res: Response) => {
  const parsed = assessSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  try {
    const input = parsed.data;
    const hasImage = !!input.image_base64 && input.image_base64.length >= 50;

    if (!hasImage) {
      const result = await lookupRepairFromAssessment({
        garment_category: input.garment_category ?? 'other',
        fiber_type: input.fiber_type ?? '',
        damage_types: input.damage_types,
        damage_description: input.damage_description,
        repair_feasibility: input.repair_feasibility,
        condition_score: input.condition_score,
        original_price_inr: input.original_price_inr,
      });
      res.json({ data: result });
      return;
    }

    const result = await assessRepair({
      image_base64: input.image_base64,
      fiber_type: input.fiber_type ?? '',
      garment_category: input.garment_category ?? 'other',
      original_price_inr: input.original_price_inr ?? 0,
      style_tags: input.style_tags,
      color_family: input.color_family,
      season: input.season,
      damage_description: input.damage_description,
      damage_types: input.damage_types,
      repair_feasibility: input.repair_feasibility,
      condition_score: input.condition_score,
    });
    res.json({ data: result });
  } catch (e: any) {
    logger.error('[Repair] Assessment failed', { error: e?.message });
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export { router as repairRouter };

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload.middleware';
import { glieLimiter, uploadLimiter } from '../middleware/rateLimiters';
import { uploadToCloudinary } from '../lib/cloudinary';
import { assessGarment } from '../services/glie';
import { fetchImageSafely, SafeFetchError } from '../lib/safeFetch';
import { sniffImageType } from '../middleware/upload.middleware';
import { logger } from '../lib/logger';
import db from '../lib/prisma';

export const glieRouter = Router();

// Base64 payloads are ~4/3 larger than the raw bytes. 10 MB image max.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16;

const assessSchema = z.object({
    image_base64: z.string().max(MAX_BASE64_CHARS).optional(),
    image_url: z.string().url().max(2048).optional(),
    image_s3_url: z.string().url().max(2048).optional(),
    fiber_type: z.string().min(1).max(60),
    garment_category: z.string().min(1).max(60),
    original_price_inr: z.coerce.number().min(0).max(10_000_000),
    style_tags: z.string().max(300).optional(),
    color_family: z.string().max(60).optional(),
    season: z.string().max(40).optional(),
    // condition_override / damage_types are debug-only inputs and are intentionally NOT accepted from clients.
  });

const correctionSchema = z.object({
  assessmentId: z.string().max(100).optional().nullable(),
  garmentCategory: z.string().min(1).max(60),
  fiberType: z.string().min(1).max(60),
  originalConditionScore: z.coerce.number().min(0).max(1),
  correctedConditionScore: z.coerce.number().min(0).max(1),
  originalRouting: z.enum(['RESELL', 'UPCYCLE', 'RECYCLE']),
  correctedRouting: z.enum(['RESELL', 'UPCYCLE', 'RECYCLE']),
  originalPriceInr: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// Fast temp upload used by the assessment flow
glieRouter.post(
  '/upload-temp',
  authenticate,
  uploadLimiter,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'image file is required' });
        return;
      }
      const result = await uploadToCloudinary(file.buffer, 'glie-temp', file.mimetype);
      res.json({ url: result.url, key: result.key });
    } catch (e: any) {
      logger.error('GLIE temp upload failed', { error: e?.message });
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Condition check (RAG + Gemini Vision). Paid per call, so: login + per-user limit.
glieRouter.post('/assess', authenticate, glieLimiter, async (req: Request, res: Response) => {
  const parsed = assessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request data' });
    return;
  }
  const { image_url, image_s3_url, ...rest } = parsed.data;
  const imageUrl = image_url || image_s3_url;

  if (!rest.image_base64 && !imageUrl) {
    res.status(400).json({ error: 'image_base64 or image_url is required' });
    return;
  }

  try {
    let imageBase64 = rest.image_base64;
    if (!imageBase64 && imageUrl) {
      try {
        const buf = await fetchImageSafely(imageUrl, { maxBytes: MAX_IMAGE_BYTES });
        if (!sniffImageType(buf)) {
          res.status(400).json({ error: 'URL did not return a JPEG, PNG or WebP image' });
          return;
        }
        imageBase64 = buf.toString('base64');
      } catch (fetchErr: any) {
        const code = fetchErr instanceof SafeFetchError ? fetchErr.code : 'FETCH_FAILED';
        logger.warn('GLIE: image download rejected', { code, userId: req.user?.id });
        res.status(400).json({ error: 'Could not use the provided image URL' });
        return;
      }
    }

    if (imageBase64) {
      const raw = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      if (raw.length > MAX_IMAGE_BYTES || !sniffImageType(raw)) {
        res.status(400).json({ error: 'Image must be a JPEG, PNG or WebP under 10 MB' });
        return;
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: 'Condition check is not available right now' });
      return;
    }

    const result = await assessGarment({ ...rest, image_base64: imageBase64! });
    res.json(result);
  } catch (e: any) {
    logger.error('GLIE assessment failed', { error: e?.message, userId: req.user?.id });
    res.status(500).json({ error: 'Assessment failed' });
  }
});

// Corrections: user feedback to improve calibration
glieRouter.post('/corrections', authenticate, glieLimiter, async (req: Request, res: Response) => {
  const parsed = correctionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request data' });
    return;
  }
  const c = parsed.data;
  try {
    const correction = await db.glieCorrection.create({
      data: {
        assessmentId: c.assessmentId || null,
        userId: req.user!.id,
        garmentCategory: c.garmentCategory,
        fiberType: c.fiberType,
        originalConditionScore: c.originalConditionScore,
        correctedConditionScore: c.correctedConditionScore,
        originalRouting: c.originalRouting,
        correctedRouting: c.correctedRouting,
        originalPriceInr: c.originalPriceInr ?? null,
        notes: c.notes || null,
      },
    });
    logger.info('[GLIE] Correction recorded', {
      id: correction.id,
      fiber: c.fiberType,
      category: c.garmentCategory,
      csDelta: c.correctedConditionScore - c.originalConditionScore,
    });
    res.status(201).json({ id: correction.id, saved: true });
  } catch (e: any) {
    logger.error('GLIE correction failed', { error: e?.message });
    res.status(500).json({ error: 'Failed to save correction' });
  }
});

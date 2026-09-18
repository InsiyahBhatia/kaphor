import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { assessRepair, lookupRepairFromAssessment } from '../services/repair.service';

const router = Router();

/**
 * POST /api/v1/repair/lookup
 *
 * Fast repair & upcycle lookup from already-computed LLM assessment:
 * ZERO re-upload, ZERO vision API re-analysis, ZERO duplicate token costs.
 * Directly matches T5 guides, curated blog tutorials, and YouTube videos.
 */
router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const input = req.body;
    if (!input.garment_category && !input.fiber_type) {
      res.status(400).json({ error: 'garment_category or fiber_type is required' });
      return;
    }
    const result = await lookupRepairFromAssessment(input);
    res.json({ data: result });
  } catch (e: any) {
    logger.error('[Repair] Lookup failed', { error: e.message });
    res.status(500).json({ error: 'Lookup failed', message: e.message });
  }
});

/**
 * POST /api/v1/repair/assess
 *
 * Full repair assessment:
 * 1. GLIE condition scoring (Gemini vision + T1-T5 RAG) if image is provided
 * 2. T5 repair/upcycle guide matching
 * 3. YouTube tutorial search
 */
router.post('/assess', async (req: Request, res: Response) => {
  try {
    const input = req.body;

    // If no image is provided, gracefully delegate to fast lookup rather than failing
    if (!input.image_base64 || typeof input.image_base64 !== 'string' || input.image_base64.length < 50) {
      const result = await lookupRepairFromAssessment(input);
      res.json({ data: result });
      return;
    }

    const result = await assessRepair(input);
    res.json({ data: result });
  } catch (e: any) {
    logger.error('[Repair] Assessment failed', { error: e.message });
    res.status(500).json({ error: 'Assessment failed', message: e.message });
  }
});

export { router as repairRouter };

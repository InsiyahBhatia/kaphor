import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { assessRepair } from '../services/repair.service';

const router = Router();

/**
 * POST /api/v1/repair/assess
 *
 * Full repair assessment:
 * 1. GLIE condition scoring (Gemini vision + T1-T5 RAG)
 * 2. T5 repair/upcycle guide matching
 * 3. YouTube tutorial search
 */
router.post('/assess', async (req: Request, res: Response) => {
  try {
    const input = req.body;

    if (!input.image_base64 || typeof input.image_base64 !== 'string' || input.image_base64.length < 100) {
      res.status(400).json({ error: 'A valid base64 image is required' });
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

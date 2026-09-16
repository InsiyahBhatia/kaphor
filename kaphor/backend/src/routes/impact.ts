import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMyImpact, getImpactReport, getPlatformSummary } from '../controllers/impact.controller';

const router = Router();

// Public platform summary
router.get('/platform-summary', getPlatformSummary);

router.use(authenticate);
router.get('/me', getMyImpact);
router.get('/me/report', getImpactReport);

export { router as impactRoutes };

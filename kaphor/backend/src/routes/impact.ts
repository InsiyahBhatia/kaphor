import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMyImpact, getImpactReport } from '../controllers/impact.controller';

const router = Router();

router.use(authenticate);
router.get('/me', getMyImpact);
router.get('/me/report', getImpactReport);

export { router as impactRoutes };

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
    getGarmentLifecycle,
    scheduleCollection,
    getPartners,
    getRecyclingCenters
} from '../controllers/circular.controller';

const router = Router();

router.get('/garment/:id', getGarmentLifecycle);
router.get('/partners', getPartners);
router.get('/recycling-centers', optionalAuth, getRecyclingCenters);

router.use(authenticate);
router.post('/schedule-collection', scheduleCollection);

export { router as circularRoutes };


import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getGarmentLifecycle,
    scheduleCollection,
    getPartners
} from '../controllers/circular.controller';

const router = Router();

router.get('/garment/:id', getGarmentLifecycle);
router.get('/partners', getPartners);

router.use(authenticate);
router.post('/schedule-collection', scheduleCollection);

export { router as circularRoutes };

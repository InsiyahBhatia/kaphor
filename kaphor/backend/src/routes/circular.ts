import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getGarmentLifecycle,
    checkCondition,
    scheduleCollection,
    getPartners
} from '../controllers/circular.controller';

const router = Router();

router.get('/garment/:id', getGarmentLifecycle);
router.get('/partners', getPartners);

router.use(authenticate);
router.post('/condition-check', checkCondition);
router.post('/schedule-collection', scheduleCollection);

export { router as circularRoutes };

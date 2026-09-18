import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
    getGarmentLifecycle,
    scheduleCollection,
    getPartners,
    getRecyclingCenters,
    onboardPartner,
    verifyPrep,
} from '../controllers/circular.controller';

const router = Router();

router.get('/garment/:id', getGarmentLifecycle);
router.get('/partners', getPartners);
router.get('/recycling-centers', optionalAuth, getRecyclingCenters);
router.post('/onboard-partner', onboardPartner);

router.use(authenticate);
router.post('/schedule-collection', scheduleCollection);
router.post('/verify-prep', verifyPrep);

export { router as circularRoutes };



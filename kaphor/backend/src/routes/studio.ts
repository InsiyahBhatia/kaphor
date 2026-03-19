import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTutorials, getTransformations, createBespokeRequest } from '../controllers/studio.controller';

const router = Router();

router.get('/tutorials', getTutorials);
router.get('/transformations', getTransformations);

router.use(authenticate);
router.post('/bespoke-request', createBespokeRequest);

export { router as studioRoutes };

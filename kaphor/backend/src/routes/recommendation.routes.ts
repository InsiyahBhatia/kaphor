import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPersonalizedFeed,
  getSimilarGarments,
  getRentalRecommendations,
  getFairSwapRecommendations,
  getUserTasteProfile,
} from '../controllers/recommendation.controller';

const router = Router();

// Similar garments can be public (e.g. browsing product dossier)
router.get('/similar/:garmentId', getSimilarGarments);

// Authenticated user recommendations
router.use(authenticate);
router.get('/for-you', getPersonalizedFeed);
router.get('/rentals', getRentalRecommendations);
router.get('/swaps', getFairSwapRecommendations);
router.get('/profile', getUserTasteProfile);

export { router as recommendationRouter };

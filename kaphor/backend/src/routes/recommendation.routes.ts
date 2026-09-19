import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  getPersonalizedFeed,
  getSimilarGarments,
  getRentalRecommendations,
  getFairSwapRecommendations,
  getUserTasteProfile,
} from '../controllers/recommendation.controller';

const router = Router();

// Similar garments and discovery feeds can be browsed publicly or personalized when logged in
router.get('/similar/:garmentId', getSimilarGarments);
router.get('/for-you', optionalAuth, getPersonalizedFeed);
router.get('/rentals', optionalAuth, getRentalRecommendations);
router.get('/swaps', optionalAuth, getFairSwapRecommendations);

// Strictly authenticated user endpoints
router.get('/profile', authenticate, getUserTasteProfile);

export { router as recommendationRouter };

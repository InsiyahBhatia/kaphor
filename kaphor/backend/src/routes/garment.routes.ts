import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../middleware/upload.middleware';
import { createGarmentSchema, updateGarmentSchema } from '../schemas';
import {
  createGarment,
  getGarments,
  getGarmentById,
  updateGarment,
  deleteGarment,
  getGarmentLifecycle,
  getCompatibilityScore,
  searchGarments,
  getGarmentFeed,
  getSellerGarments,
  getWishlistGarments,
} from '../controllers/garment.controller';
import {
  initiateResell,
  relistGarment,
  markCircularEnd,
} from '../controllers/lifecycle.controller';

export const garmentRouter = Router();

garmentRouter.get('/', optionalAuth, searchGarments);
garmentRouter.get('/feed', optionalAuth, getGarmentFeed);
garmentRouter.get('/me', authenticate, getSellerGarments);
garmentRouter.get('/wishlist', authenticate, getWishlistGarments);
garmentRouter.get('/browse', optionalAuth, getGarments);
garmentRouter.get('/:id', getGarmentById);
garmentRouter.get('/:id/lifecycle', authenticate, getGarmentLifecycle);
garmentRouter.get('/:id/compatibility', authenticate, getCompatibilityScore);

garmentRouter.post('/',
  authenticate,
  upload.array('images', 8),
  validate({ body: createGarmentSchema }),
  createGarment
);

garmentRouter.put('/:id',
  authenticate,
  upload.array('images', 8),
  validate({ body: updateGarmentSchema }),
  updateGarment
);

garmentRouter.delete('/:id', authenticate, deleteGarment);

// ── Lifecycle State Machine Endpoints ──────────────
garmentRouter.post('/:id/initiate-resell', authenticate, initiateResell);
garmentRouter.post('/:id/relist', authenticate, relistGarment);
garmentRouter.post('/:id/circular-end', authenticate, markCircularEnd);

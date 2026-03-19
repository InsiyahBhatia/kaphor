import { Router } from 'express';
import { body, query } from 'express-validator';
import { validateRequeset } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
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
} from '../controllers/garment.controller';

export const garmentRouter = Router();

garmentRouter.get('/', searchGarments);
garmentRouter.get('/feed', authenticate, getGarmentFeed);
garmentRouter.get('/me', authenticate, getSellerGarments);
garmentRouter.get('/browse', getGarments);
garmentRouter.get('/:id', getGarmentById);
garmentRouter.get('/:id/lifecycle', authenticate, getGarmentLifecycle);
garmentRouter.get('/:id/compatibility', authenticate, getCompatibilityScore);

garmentRouter.post('/',
  authenticate,
  upload.array('images', 8),
  [
    body('title').isLength({ min: 3, max: 100 }),
    body('description').isLength({ min: 10, max: 1000 }),
    body('category').notEmpty(),
    body('condition').notEmpty(),
    body('size').notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('isAccessory').optional().isBoolean(),
  ],
  validateRequeset,
  createGarment
);

garmentRouter.put('/:id',
  authenticate,
  upload.array('images', 8),
  validateRequeset,
  updateGarment
);

garmentRouter.delete('/:id', authenticate, deleteGarment);

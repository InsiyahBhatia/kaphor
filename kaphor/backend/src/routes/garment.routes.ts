import { Router } from 'express';
import { body, query } from 'express-validator';
import { validateRequeset } from '../middleware/validation.middleware';
import { authenticate, optionalAuth } from '../middleware/auth';
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
  getWishlistGarments,
} from '../controllers/garment.controller';

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
  [
    body('title').isLength({ min: 3, max: 100 }),
    body('description').isLength({ min: 10, max: 1000 }),
    body('category').notEmpty(),
    body('condition').notEmpty(),
    body('size').notEmpty(),
    body('listingType')
      .notEmpty()
      .isIn(['SALE', 'RENTAL', 'ACCESSORY_SWAP']),

    // Pricing depends on listing type
    body('price')
      .optional({ nullable: true })
      .custom((value, { req }) => {
        const listingType = req.body?.listingType as string | undefined;
        const needsPrice = listingType === 'SALE' || listingType === 'ACCESSORY_SWAP';

        if (needsPrice) {
          const raw = value === undefined || value === null ? '' : String(value).trim();
          if (!raw) throw new Error('price is required for this listing type');

          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error('price must be a number >= 0');
          }
        }
        return true;
      }),

    body('rentalPriceDay')
      .optional({ nullable: true })
      .custom((value, { req }) => {
        const listingType = req.body?.listingType as string | undefined;
        const needsRental = listingType === 'RENTAL';

        if (needsRental) {
          const raw = value === undefined || value === null ? '' : String(value).trim();
          if (!raw) throw new Error('rentalPriceDay is required for RENTAL listings');

          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error('rentalPriceDay must be a number >= 0');
          }
        }
        return true;
      }),

    body('rentalPriceWeek')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === undefined || value === null || value === '') return true;
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error('rentalPriceWeek must be a number >= 0');
        }
        return true;
      }),

    body('isAccessory').optional().isBoolean(),
  ],
  validateRequeset,
  createGarment
);

garmentRouter.put('/:id',
  authenticate,
  upload.array('images', 8),
  [
    body('title').optional().isLength({ min: 3, max: 100 }),
    body('description').optional().isLength({ min: 10, max: 1000 }),
    body('category').optional().notEmpty(),
    body('condition').optional().notEmpty(),
    body('size').optional().notEmpty(),
    body('listingType').optional().isIn(['SALE', 'RENTAL', 'ACCESSORY_SWAP']),
    body('price').optional({ nullable: true }).custom((value, { req }) => {
      if (value === undefined || value === null || value === '') return true;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error('price must be a number >= 0');
      return true;
    }),
    body('rentalPriceDay').optional({ nullable: true }).custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error('rentalPriceDay must be a number >= 0');
      return true;
    }),
    body('rentalPriceWeek').optional({ nullable: true }).custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error('rentalPriceWeek must be a number >= 0');
      return true;
    }),
  ],
  validateRequeset,
  updateGarment
);

garmentRouter.delete('/:id', authenticate, deleteGarment);

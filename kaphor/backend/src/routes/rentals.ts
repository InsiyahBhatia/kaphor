import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  getAvailableRentals,
  createRental,
  getMyRentals,
  returnRental,
  calculateRentalBreakdown,
  getRentalEscrow,
  releaseRentalDeposit,
  dispatchRental,
} from '../controllers/rental.controller';

const router = Router();

// Public routes (with optional authentication to exclude user's own garments)
router.get('/available', optionalAuth, getAvailableRentals);
router.post('/calculate', calculateRentalBreakdown);

// Authenticated routes
router.use(authenticate);
router.post('/', createRental);
router.get('/me', getMyRentals);
router.get('/:id/escrow', getRentalEscrow);
router.post('/:id/release-deposit', releaseRentalDeposit);
router.patch('/:id/dispatch', dispatchRental);
router.patch('/:id/return', returnRental);

export { router as rentalRoutes };

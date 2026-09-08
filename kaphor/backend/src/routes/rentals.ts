import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAvailableRentals,
  createRental,
  getMyRentals,
  returnRental,
  calculateRentalBreakdown,
  getRentalEscrow,
  releaseRentalDeposit,
} from '../controllers/rental.controller';

const router = Router();

// Public routes
router.get('/available', getAvailableRentals);
router.post('/calculate', calculateRentalBreakdown);

// Authenticated routes
router.use(authenticate);
router.post('/', createRental);
router.get('/me', getMyRentals);
router.get('/:id/escrow', getRentalEscrow);
router.post('/:id/release-deposit', releaseRentalDeposit);
router.patch('/:id/return', returnRental);

export { router as rentalRoutes };

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  getAvailableRentals,
  checkRentalAvailability,
  createRental,
  getMyRentals,
  getRentalById,
  returnRental,
  calculateRentalBreakdown,
  getRentalEscrow,
  releaseRentalDeposit,
  dispatchRental,
  approveRentalRequest,
  declineRentalRequest,
  confirmRentalPayment,
  confirmRentalDelivery,
  confirmReturnDelivery,
  postRentalReview,
} from '../controllers/rental.controller';

const router = Router();

// Public routes (with optional authentication to exclude user's own garments)
router.get('/available', optionalAuth, getAvailableRentals);
router.get('/check-availability', optionalAuth, checkRentalAvailability);
router.post('/calculate', calculateRentalBreakdown);

// Authenticated routes
router.use(authenticate);
router.post('/', createRental);
router.get('/me', getMyRentals);
router.get('/:id', getRentalById);
router.get('/:id/escrow', getRentalEscrow);
router.post('/:id/approve', approveRentalRequest);
router.post('/:id/decline', declineRentalRequest);
router.post('/:id/confirm-payment', confirmRentalPayment);
router.post('/:id/confirm-delivery', confirmRentalDelivery);
router.post('/:id/confirm-return-delivery', confirmReturnDelivery);
router.post('/:id/release-deposit', releaseRentalDeposit);
router.patch('/:id/dispatch', dispatchRental);
router.patch('/:id/return', returnRental);
router.post('/:id/review', postRentalReview);

export { router as rentalRoutes };

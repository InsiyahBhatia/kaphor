import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getAvailableRentals, createRental, getMyRentals, returnRental } from '../controllers/rental.controller';

const router = Router();

router.get('/available', getAvailableRentals);

router.use(authenticate);
router.post('/', createRental);
router.get('/me', getMyRentals);
router.patch('/:id/return', returnRental);

export { router as rentalRoutes };

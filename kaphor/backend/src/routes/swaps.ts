import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createSwapRequest, getSwaps, respondToSwap, completeSwap } from '../controllers/swap.controller';

const router = Router();

router.use(authenticate);

router.post('/', createSwapRequest);
router.get('/', getSwaps);
router.patch('/:id', respondToSwap);
router.post('/:id/complete', completeSwap);

export { router as swapRoutes };

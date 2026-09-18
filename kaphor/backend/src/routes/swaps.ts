import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  getSwapFeed,
  getSwaps,
  getSwapById,
  createSwapRequest,
  respondToSwap,
  signSwapAgreement,
  getSwapAgreement,
  shareSwapAddress,
  getShippingAddress,
  markSwapShipped,
  confirmSwapReceived,
  completeSwap,
  paySecurityDeposit,
  verifySecurityDeposit,
  getDepositStatus,
  openDispute,
  getDispute,
  cancelSwap,
  postSwapReview,
} from '../controllers/swap.controller';

const router = Router();

// Public / discovery endpoints (authenticated users get personalized prioritization)
router.get('/feed', optionalAuth, getSwapFeed);

// Protected transaction & request endpoints
router.use(authenticate);

// Requests & listing for current user
router.get('/', getSwaps);
router.post('/', createSwapRequest);
router.get('/:id', getSwapById);

// Response (Accept / Reject)
router.patch('/:id', respondToSwap);
router.post('/:id/respond', respondToSwap);

// Agreement
router.get('/:id/agreement', getSwapAgreement);
router.post('/:id/sign-agreement', signSwapAgreement);

// Address sharing (post-agreement only)
router.get('/:id/shipping-address', getShippingAddress);
router.post('/:id/address', shareSwapAddress);

// Shipping & delivery confirmation
router.post('/:id/ship', markSwapShipped);
router.post('/:id/confirm-received', confirmSwapReceived);
router.post('/:id/complete', completeSwap);

// Escrow Security Deposit
router.post('/:id/pay-deposit', paySecurityDeposit);
router.post('/:id/verify-deposit', verifySecurityDeposit);
router.get('/:id/deposit', getDepositStatus);

// Disputes & Cancellation & Reviews
router.post('/:id/dispute', openDispute);
router.get('/:id/dispute', getDispute);
router.post('/:id/cancel', cancelSwap);
router.post('/:id/review', postSwapReview);

export { router as swapRoutes };

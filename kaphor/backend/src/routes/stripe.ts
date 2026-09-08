import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { handleWebhook } from '../controllers/stripe.controller';
import {
  getPaymentHistory,
  getSellerPayouts,
  requestRefund,
} from '../controllers/payment-ops.controller';

export const stripeRouter = Router();

// Stripe webhook (requires raw body from index.ts)
stripeRouter.post('/webhook', handleWebhook);

// Authenticated unified payment operations
stripeRouter.get('/history', authenticate, getPaymentHistory);
stripeRouter.get('/payouts', authenticate, getSellerPayouts);
stripeRouter.post('/refund', authenticate, requestRefund);

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getPaymentHistory, getSellerPayouts, requestRefund } from '../controllers/payment-ops.controller';

export const paymentsRouter = Router();

// Mounted at /payments AFTER /payments/razorpay so the webhook route is never shadowed.
paymentsRouter.get('/history', authenticate, getPaymentHistory);
paymentsRouter.get('/payouts', authenticate, getSellerPayouts);
paymentsRouter.post('/refund', authenticate, requestRefund);

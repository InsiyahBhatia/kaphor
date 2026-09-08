import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createRazorpayOrder,
  createRazorpayOrderForExistingOrder,
  createRazorpayOrderForRental,
  verifyRazorpayPayment,
  razorpayWebhook,
} from '../controllers/razorpay.controller';

export const razorpayRouter = Router();

// Authenticated routes
razorpayRouter.post('/create-order', authenticate, createRazorpayOrder);
razorpayRouter.post('/create-order-for-order', authenticate, createRazorpayOrderForExistingOrder);
razorpayRouter.post('/create-rental-order', authenticate, createRazorpayOrderForRental);
razorpayRouter.post('/verify', authenticate, verifyRazorpayPayment);

// Public webhook (Razorpay calls this directly — no auth middleware, uses signature verification)
razorpayRouter.post('/webhook', razorpayWebhook);

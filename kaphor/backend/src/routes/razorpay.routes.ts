import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createRazorpayOrder, verifyRazorpayPayment } from '../controllers/razorpay.controller';

export const razorpayRouter = Router();

razorpayRouter.post('/create-order', authenticate, createRazorpayOrder);


import { Router } from 'express';
import { handleWebhook } from '../controllers/stripe.controller';

export const stripeRouter = Router();

// Stripe requires the raw body for signature verification.
// Our index.ts already captures this in req.rawBody.
stripeRouter.post('/webhook', handleWebhook);

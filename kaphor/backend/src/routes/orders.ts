import { Router } from 'express';
import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createPaymentIntent } from '../controllers/order.controller';

const router = Router();

// Endpoint for the app to create a new order and receive a payment intent secret
router.post('/', authenticate, createPaymentIntent);

export { router as orderRoutes };

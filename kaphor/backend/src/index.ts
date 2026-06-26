import 'dotenv/config';
import http from 'http';
import { initSocket } from './lib/socket';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { z } from 'zod';

import db from './lib/prisma';
import { logger } from './lib/logger';
import path from 'path';

// ── Startup Environment Validation ──────────────────────────────────────────
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081'),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  console.error('❌ Invalid or missing environment variables:');
  for (const issue of envResult.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}
const validatedEnv = envResult.data;

// Routes
import { authRouter } from './routes/auth.routes';
import { garmentRouter } from './routes/garment.routes';
import { socialRoutes } from './routes/social';
import { interactionRouter } from './routes/interaction.routes';
import { userRoutes } from './routes/users';
import { impactRoutes } from './routes/impact';
import { studioRoutes } from './routes/studio';
import { circularRoutes } from './routes/circular';
import { aiRoutes } from './routes/ai';
import { notificationRoutes } from './routes/notifications';
import { orderRoutes } from './routes/orders';
import { rentalRoutes } from './routes/rentals';
import { swapRoutes } from './routes/swaps';
import { stripeRouter } from './routes/stripe';
import { razorpayRouter } from './routes/razorpay.routes';
import { cartRouter } from './routes/cart.routes';
import { adminRouter } from './routes/admin.routes';

const app = express();
const httpServer = http.createServer(app);

const PORT = validatedEnv.PORT;
const API_VERSION = process.env.API_VERSION || 'v1';
const REDIS_URL = validatedEnv.REDIS_URL;

const ALLOWED_ORIGINS = validatedEnv.ALLOWED_ORIGINS
  .split(',')
  .map((o: string) => o.trim());

/** Middleware */
app.use(helmet());
app.use(compression());

// Stripe webhook needs raw body before JSON parsing
app.use('/api/v1/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    (req as any).rawBody = req.body;
    next();
  }
);
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: validatedEnv.NODE_ENV === 'production' ? ALLOWED_ORIGINS : true,
    credentials: true,
  })
);

// ── Redis-backed Rate Limiter ────────────────────────────────────────────────
let redisRateStore: any = undefined;
try {
  const Redis = require('ioredis');
  const redisClient = new Redis(REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  redisClient.on('error', () => { /* fallback to memory store */ });
  redisRateStore = new RedisStore({
    sendCommand: (...args: [string, ...string[]]) => (redisClient as any).call(...args),
  });
} catch {
  logger.warn('Redis unavailable for rate limiter — using default memory store');
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  store: redisRateStore,
});

app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' },
  store: redisRateStore,
});

/** Routes */
const baseApiUrl = `/api/${API_VERSION}`;

// Stricter rate limiting on auth endpoints
app.use(`${baseApiUrl}/auth/login`, authLimiter);
app.use(`${baseApiUrl}/auth/register`, authLimiter);
app.use(`${baseApiUrl}/auth/google`, authLimiter);
app.use(`${baseApiUrl}/auth/forgot-password`, authLimiter);
app.use(`${baseApiUrl}/auth/reset-password`, authLimiter);

app.use(`${baseApiUrl}/auth`, authRouter);
app.use(`${baseApiUrl}/garments`, garmentRouter);
app.use(`${baseApiUrl}/social`, socialRoutes);
app.use(`${baseApiUrl}/interactions`, interactionRouter);
app.use(`${baseApiUrl}/users`, userRoutes);
app.use(`${baseApiUrl}/impact`, impactRoutes);
app.use(`${baseApiUrl}/studio`, studioRoutes);
app.use(`${baseApiUrl}/circular`, circularRoutes);
app.use(`${baseApiUrl}/ai`, aiRoutes);
app.use(`${baseApiUrl}/notifications`, notificationRoutes);
app.use(`${baseApiUrl}/orders`, orderRoutes);
app.use(`${baseApiUrl}/rentals`, rentalRoutes);
app.use(`${baseApiUrl}/swaps`, swapRoutes);
app.use(`${baseApiUrl}/payments`, stripeRouter);
app.use(`${baseApiUrl}/payments/razorpay`, razorpayRouter);
app.use(`${baseApiUrl}/cart`, cartRouter);
app.use(`${baseApiUrl}/admin`, adminRouter);

/** HEALTH CHECK */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/** TEST DB CONNECTION */
app.get('/test-db', async (_req, res) => {
  try {
    await db.$connect();
    res.json({ message: 'DB connected successfully' });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/** GLOBAL ERROR HANDLER */
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled Error', {
    error: err.message,
    stack: err.stack,
    path: req.url,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
  });
});

/** 404 */
app.use((_req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
  });
});

/** START SERVER */
async function main() {
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '../uploads');
  const garmentDirs = path.join(uploadsDir, 'garments');
  const profileDirs = path.join(uploadsDir, 'profiles');
  
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  if (!fs.existsSync(garmentDirs)) fs.mkdirSync(garmentDirs, { recursive: true });
  if (!fs.existsSync(profileDirs)) fs.mkdirSync(profileDirs, { recursive: true });

  // Try to connect but don't crash if unreachable — Prisma will retry lazily
  try {
    await db.$connect();
    console.log('✅ Database connected');
  } catch (err: any) {
    console.warn('⚠️  Database connection failed at startup (will retry on first request):', err.message);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    initSocket(httpServer);
    console.log('🔌 Socket.io initialized');
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
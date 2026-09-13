import 'dotenv/config';
import http from 'http';
import { initSocket } from './lib/socket';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
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
import { repairRouter } from './routes/repair.routes';
import { messageRoutes } from './routes/messages';
import { recommendationRouter } from './routes/recommendation.routes';
import { assessGarment, initGLIE } from './services/glie';
import { upload } from './middleware/upload.middleware';
import { uploadToS3 } from './lib/s3';

const app = express();
const httpServer = http.createServer(app);
app.set('trust proxy', 1);

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
app.use('/api/v1/uploads', express.static(path.join(__dirname, '../uploads')));
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

// ── Rate Limiter ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});

app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' },
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
app.use(`${baseApiUrl}/repair`, repairRouter);
app.use(`${baseApiUrl}/messages`, messageRoutes);
app.use(`${baseApiUrl}/recommendations`, recommendationRouter);

// ── GLIE Temp Image Upload (fast, no auth required) ────────────────────────
app.post(`${baseApiUrl}/glie/upload-temp`, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'image file is required' });
      return;
    }
    const result = await uploadToS3(file.buffer, 'glie-temp', file.mimetype);
    res.json({ url: result.url, key: result.key });
  } catch (e: any) {
    logger.error('GLIE temp upload failed', { error: e.message });
    res.status(500).json({ error: 'Upload failed', message: e.message });
  }
});

// ── GLIE Condition Check (RAG + Gemini Vision Pipeline) ────────────────────
app.post(`${baseApiUrl}/glie/assess`, async (req: Request, res: Response) => {
  try {
    const input = req.body;
    // Accept either image_base64 (legacy) or image_s3_url (preferred)
    if (!input.image_base64 && !input.image_s3_url) {
      res.status(400).json({ error: 'image_base64 or image_s3_url is required' });
      return;
    }
    // If image_s3_url provided, download the image and convert to base64
    if (input.image_s3_url && !input.image_base64) {
      try {
        const response = await fetch(input.image_s3_url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        input.image_base64 = buffer.toString('base64');
      } catch (fetchErr: any) {
        logger.error('GLIE: Failed to download image from S3', { error: fetchErr.message, url: input.image_s3_url });
        res.status(400).json({ error: 'Failed to fetch image from provided URL' });
        return;
      }
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      return;
    }
    const result = await assessGarment(input);
    res.json(result);
  } catch (e: any) {
    logger.error('GLIE assessment failed', { error: e.message });
    res.status(500).json({ error: 'Assessment failed', message: e.message });
  }
});

/** HEALTH CHECK */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

    // Load GLIE data asynchronously after server is accepting connections
    // This avoids blocking startup with 3.5MB+ of CSV/JSON parsing
    setImmediate(() => {
      try {
        initGLIE();
        console.log('📊 GLIE data loaders initialized');
      } catch (err: any) {
        console.warn('⚠️  GLIE init failed (will retry on first request):', err.message);
      }
    });
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
import 'dotenv/config';
import http from 'http';
import { initSocket } from './lib/socket';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import db from './lib/prisma';
import { logger } from './lib/logger';
import path from 'path';

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

const PORT = Number(process.env.PORT) || 4000;
const API_VERSION = process.env.API_VERSION || 'v1';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((o) => o.trim());

/** ✅ TEST ENV LOADING */
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("ENV PATH:", path.resolve('.env'));
/** Middleware */
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: true, // Allow all origins in development
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Generous for local development
});

app.use(limiter);

/** Routes */
const baseApiUrl = `/api/${API_VERSION}`;
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

  await db.$connect();
  console.log('Database connected');

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    initSocket(httpServer);
    console.log('Socket.io initialized');
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
import 'dotenv/config';
import './lib/asyncErrors'; // makes rejected async route handlers reach the error middleware (Express 4)
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';

// ── Startup Environment Validation ──────────────────────────────────────────
// This runs BEFORE the app modules are loaded, so a bad config stops the process early.
const WEAK_SECRET_HINTS = ['change-me', 'changeme', 'secret', 'password', 'example', 'placeholder', 'dev-only', 'test-'];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_VERSION: z.string().default('v1'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  BACKEND_URL: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  // Payments
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // AI
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  // Storage
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  // Push
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  // Google sign-in
  GOOGLE_CLIENT_ID: z.string().optional(),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string().optional(),
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: z.string().optional(),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  console.error('Invalid or missing environment variables:');
  for (const issue of envResult.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}
const validatedEnv = envResult.data;
const isProd = validatedEnv.NODE_ENV === 'production';

function validateProductionEnv(env: typeof validatedEnv): string[] {
  const problems: string[] = [];
  const has = (v?: string) => !!v && v.trim().length > 0;

  // Secrets: long enough, not placeholders, not reused
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const v = env[key];
    if (v.length < 32) problems.push(`${key} must be at least 32 characters in production`);
    if (WEAK_SECRET_HINTS.some((h) => v.toLowerCase().includes(h))) {
      problems.push(`${key} looks like a default or placeholder value. Generate a random one.`);
    }
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  // CORS must be explicit
  if (!has(env.ALLOWED_ORIGINS)) {
    (env as any).ALLOWED_ORIGINS = 'https://kaphor-backend.onrender.com,http://localhost:8081,exp://localhost:8081';
  } else if (env.ALLOWED_ORIGINS!.split(',').some((o) => o.trim() === '*')) {
    problems.push('ALLOWED_ORIGINS must not contain "*"');
  }

  // Features: if one part of a feature is set, all of it must be
  const group = (name: string, keys: (keyof typeof env)[], requireAllIfAny = true) => {
    const set = keys.filter((k) => has(env[k] as string | undefined));
    if (requireAllIfAny && set.length > 0 && set.length < keys.length) {
      const missing = keys.filter((k) => !has(env[k] as string | undefined));
      problems.push(`${name} is partly configured. Missing: ${missing.join(', ')}`);
    }
  };
  group('Razorpay', ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']);
  group('Stripe', ['STRIPE_SECRET_KEY']);
  group('Cloudinary', ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);
  group('AWS S3', ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET_NAME']);
  group('Firebase', ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']);

  return problems;
}

if (isProd) {
  const problems = validateProductionEnv(validatedEnv);
  if (problems.length) {
    console.error('Refusing to start in production:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const warn = (m: string) => console.warn(`[config warning] ${m}`);
  if (validatedEnv.RAZORPAY_KEY_ID && !validatedEnv.RAZORPAY_WEBHOOK_SECRET) {
    warn('RAZORPAY_WEBHOOK_SECRET not set: orders and payments work, but webhook background sync is disabled until registered in the Razorpay dashboard.');
  }
  if (!validatedEnv.REDIS_URL) warn('REDIS_URL not set: realtime socket mapping uses in-memory storage (single instance only).');
  if (!validatedEnv.CLOUDINARY_CLOUD_NAME && !validatedEnv.AWS_S3_BUCKET_NAME) {
    warn('No Cloudinary or S3 configured: uploads fall back to local disk, which is erased on every Render deploy.');
  }
  if (!validatedEnv.FRONTEND_URL) warn('FRONTEND_URL not set: email links will point to localhost.');
  if (!validatedEnv.GEMINI_API_KEY) warn('GEMINI_API_KEY not set: AI condition checks are disabled.');
}

// Load the rest of the app only after the environment is known to be valid.
/* eslint-disable @typescript-eslint/no-var-requires */
const db = require('./lib/prisma').default as typeof import('./lib/prisma').default;
const { logger } = require('./lib/logger') as typeof import('./lib/logger');
const { initSocket, closeSocket, getAllowedOrigins } = require('./lib/socket') as typeof import('./lib/socket');
const { closeRedis } = require('./lib/redis') as typeof import('./lib/redis');
const rl = require('./middleware/rateLimiters') as typeof import('./middleware/rateLimiters');
const { initGLIE } = require('./services/glie') as typeof import('./services/glie');
const { defaultApiCacheHeaders } = require('./lib/httpCache') as typeof import('./lib/httpCache');

const { authRouter } = require('./routes/auth.routes') as typeof import('./routes/auth.routes');
const { garmentRouter } = require('./routes/garment.routes') as typeof import('./routes/garment.routes');
const { interactionRouter } = require('./routes/interaction.routes') as typeof import('./routes/interaction.routes');
const { userRoutes } = require('./routes/users') as typeof import('./routes/users');
const { impactRoutes } = require('./routes/impact') as typeof import('./routes/impact');
const { studioRoutes } = require('./routes/studio') as typeof import('./routes/studio');
const { circularRoutes } = require('./routes/circular') as typeof import('./routes/circular');
const { aiRoutes } = require('./routes/ai') as typeof import('./routes/ai');
const { notificationRoutes } = require('./routes/notifications') as typeof import('./routes/notifications');
const { orderRoutes } = require('./routes/orders') as typeof import('./routes/orders');
const { rentalRoutes } = require('./routes/rentals') as typeof import('./routes/rentals');
const { swapRoutes } = require('./routes/swaps') as typeof import('./routes/swaps');
const { stripeRouter } = require('./routes/stripe') as typeof import('./routes/stripe');
const { razorpayRouter } = require('./routes/razorpay.routes') as typeof import('./routes/razorpay.routes');
const { adminRouter } = require('./routes/admin.routes') as typeof import('./routes/admin.routes');
const { repairRouter } = require('./routes/repair.routes') as typeof import('./routes/repair.routes');
const { messageRoutes } = require('./routes/messages') as typeof import('./routes/messages');
const { recommendationRouter } = require('./routes/recommendation.routes') as typeof import('./routes/recommendation.routes');
const { glieRouter } = require('./routes/glie.routes') as typeof import('./routes/glie.routes');
/* eslint-enable @typescript-eslint/no-var-requires */

const app = express();
const httpServer = http.createServer(app);

app.disable('x-powered-by');
// Render puts exactly one proxy (its load balancer) in front of the app, so trust one hop.
// This makes req.ip the real client IP, which the rate limiters depend on.
app.set('trust proxy', 1);

const PORT = validatedEnv.PORT;
const API_VERSION = validatedEnv.API_VERSION;
const baseApiUrl = `/api/${API_VERSION}`;

let shuttingDown = false;

// ── Request id + safe request logging ───────────────────────────────────────
// Logs method + PATH ONLY (never the query string, which can contain tokens), plus a request id
// that is also returned to the client in X-Request-Id so support can find the log line.
app.use((req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  (req as any).id = id;
  res.setHeader('X-Request-Id', id);
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/health' || req.path === '/ready') return;
    logger.info('request', {
      id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
      userId: (req as any).user?.id,
    });
  });
  next();
});

// ── Health checks (before any heavy middleware) ─────────────────────────────
// /health: cheap liveness probe. /ready: checks the database.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req, res) => {
  if (shuttingDown) {
    res.status(503).json({ status: 'shutting_down' });
    return;
  }
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 3000)),
    ]);
    res.json({ status: 'ready' });
  } catch (err: any) {
    logger.error('Readiness check failed', { error: err?.message });
    res.status(503).json({ status: 'not_ready' });
  }
});

// ── Security headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    // This is a JSON API, not an HTML site, so CSP is not useful here.
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    // Images must be loadable from the app and from the web frontend on another origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: false } : false,
    frameguard: { action: 'deny' },
  })
);
app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      // Images are already compressed; gzip would only burn CPU.
      if (/^(\/api\/[^/]+)?\/uploads\//.test(req.path) || /^image\//.test(String(res.getHeader('Content-Type') || ''))) return false;
      return compression.filter(req, res);
    },
  })
);

// ── CORS ────────────────────────────────────────────────────────────────────
// Mobile apps send no Origin header, so requests without one are allowed.
// Browsers must come from ALLOWED_ORIGINS. In development, localhost on any port is also allowed.
const ALLOWED_ORIGINS = getAllowedOrigins();
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (!isProd && DEV_ORIGIN_RE.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    credentials: true,
    maxAge: 600,
  })
);

// ── Global rate limit ───────────────────────────────────────────────────────
app.use(rl.globalLimiter);

// ── Body parsing ────────────────────────────────────────────────────────────
// 1) Webhooks need the raw bytes so the signature can be checked. Mounted first.
const captureRawBody = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).rawBody = req.body;
  next();
};
app.use(`${baseApiUrl}/payments/webhook`, rl.webhookLimiter, express.raw({ type: '*/*', limit: '1mb' }), captureRawBody);
app.use(`${baseApiUrl}/payments/razorpay/webhook`, rl.webhookLimiter, express.raw({ type: '*/*', limit: '1mb' }), captureRawBody);

// 2) Only routes that accept base64 images get the larger limit.
const bigJson = express.json({ limit: '12mb' });
app.use(`${baseApiUrl}/glie/assess`, bigJson);
app.use(`${baseApiUrl}/repair`, bigJson);
app.use(`${baseApiUrl}/ai`, bigJson);
app.use(`${baseApiUrl}/studio`, bigJson);
app.post(`${baseApiUrl}/messages/conversations/:conversationId`, bigJson);

// 3) Everything else: small bodies. (body-parser skips requests that were already parsed above.)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static uploads (images only) ────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;
const serveUploads = [
  (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
    if (!IMAGE_EXT_RE.test(req.path)) return res.status(404).json({ error: 'NOT_FOUND' });
    return next();
  },
  express.static(UPLOADS_DIR, {
    index: false, // no directory index
    redirect: false, // no directory redirects / listing hints
    dotfiles: 'deny',
    fallthrough: false,
    maxAge: '7d',
    setHeaders(res: Response) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  }),
];
app.use('/uploads', ...serveUploads);
app.use(`${baseApiUrl}/uploads`, ...serveUploads);

// ── Targeted rate limits (applied before the routers) ───────────────────────
// Auth
app.use(`${baseApiUrl}/auth/login`, rl.loginLimiter, rl.loginPerAccountLimiter);
app.use(`${baseApiUrl}/auth/register`, rl.authLimiter);
app.use(`${baseApiUrl}/auth/google`, rl.authLimiter);
app.use(`${baseApiUrl}/auth/refresh`, rl.refreshLimiter);
app.use(`${baseApiUrl}/auth/forgot-password`, rl.passwordResetLimiter);
app.use(`${baseApiUrl}/auth/reset-password`, rl.passwordResetLimiter);
app.use(`${baseApiUrl}/auth/verify-email`, rl.verifyTokenLimiter);
// Money
app.use(`${baseApiUrl}/payments`, rl.paymentLimiter);
app.post(`${baseApiUrl}/orders`, rl.paymentLimiter);
app.post(`${baseApiUrl}/orders/:orderId/approve`, rl.paymentLimiter);
app.post(`${baseApiUrl}/rentals`, rl.paymentLimiter);
app.post(`${baseApiUrl}/rentals/:id/confirm-payment`, rl.paymentLimiter);
app.post(`${baseApiUrl}/swaps/:id/pay-deposit`, rl.paymentLimiter);
app.post(`${baseApiUrl}/swaps/:id/verify-deposit`, rl.paymentLimiter);
// Chat
app.post(`${baseApiUrl}/messages/conversations/:conversationId`, rl.messageSendLimiter);
app.post(`${baseApiUrl}/orders/:orderId/messages`, rl.messageSendLimiter);
// Uploads
app.post(`${baseApiUrl}/garments`, rl.uploadLimiter);
app.put(`${baseApiUrl}/garments/:id`, rl.uploadLimiter);
app.put(`${baseApiUrl}/users/me/avatar`, rl.uploadLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use(baseApiUrl, defaultApiCacheHeaders);
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
app.use(`${baseApiUrl}/payments/razorpay`, razorpayRouter); // before /payments so its webhook is not shadowed
app.use(`${baseApiUrl}/payments`, stripeRouter);
app.use(`${baseApiUrl}/admin`, adminRouter);
app.use(`${baseApiUrl}/repair`, repairRouter);
app.use(`${baseApiUrl}/messages`, messageRoutes);
app.use(`${baseApiUrl}/recommendations`, recommendationRouter);
app.use(`${baseApiUrl}/glie`, glieRouter);

/** 404 */
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

/** GLOBAL ERROR HANDLER */
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  409: 'Conflict',
  413: 'Request is too large',
  415: 'Unsupported media type',
  422: 'Unprocessable request',
  429: 'Too many requests',
};

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  let status = Number(err?.status || err?.statusCode) || 500;
  let code: string = err?.code && typeof err.code === 'string' ? err.code : 'INTERNAL_SERVER_ERROR';
  let message: string | undefined;

  // Known client-side errors get a friendly, safe message
  if (err?.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request is too large';
  } else if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    status = 400; code = 'INVALID_JSON'; message = 'Request body is not valid JSON';
  } else if (err?.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = String(err.code);
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB)' : 'Invalid upload';
  } else if (typeof err?.message === 'string' && err.message.startsWith('INVALID_FILE_TYPE')) {
    status = 400; code = 'INVALID_FILE_TYPE'; message = 'Only JPG, PNG and WebP images are allowed';
  }
  if (status < 400 || status > 599) status = 500;

  const logMeta = {
    id: (req as any).id,
    error: err?.message,
    stack: err?.stack,
    path: req.path, // no query string
    method: req.method,
    status,
  };
  if (status >= 500) logger.error('Unhandled Error', logMeta);
  else logger.warn('Request error', { ...logMeta, stack: undefined });

  const safeMessage = message || (status >= 500 ? 'An unexpected error occurred' : STATUS_TEXT[status] || 'Request failed');
  res.status(status).json({
    error: status >= 500 ? 'INTERNAL_SERVER_ERROR' : code,
    message: !isProd && status >= 500 ? err?.message || safeMessage : safeMessage,
    requestId: (req as any).id,
  });
});

/** START SERVER */
async function main() {
  // Make sure upload folders exist (only used when Cloudinary / S3 are not configured)
  for (const dir of [UPLOADS_DIR, path.join(UPLOADS_DIR, 'garments'), path.join(UPLOADS_DIR, 'profiles')]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Pre-warm the database connection WITHOUT delaying startup. Prisma shares one connect promise, so a request that
  // arrives while this is still running simply waits for it instead of failing. Never crashes if unreachable.
  void db
    .$connect()
    .then(() => logger.info('Database connected'))
    .catch((err: any) =>
      logger.warn('Database connection failed at startup (will retry on first request)', { error: err?.message })
    );

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on 0.0.0.0:${PORT} (${validatedEnv.NODE_ENV})`);
    initSocket(httpServer);
    logger.info('Socket.io initialized');

    // Load GLIE data after the server is accepting connections (3.5MB+ of CSV/JSON parsing)
    setImmediate(() => {
      try {
        initGLIE();
        logger.info('GLIE data loaders initialized');
      } catch (err: any) {
        logger.warn('GLIE init failed (will retry on first request)', { error: err?.message });
      }
    });
  });

  // Slow-client protection
  httpServer.keepAliveTimeout = 65_000; // longer than Render's load balancer (60s)
  httpServer.headersTimeout = 66_000; // must be above keepAliveTimeout or Node can drop reused connections
  httpServer.requestTimeout = 120_000; // AI calls can be slow
}

// ── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received: shutting down`);

  // Hard stop if something hangs (Render waits 30s before SIGKILL)
  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(exitCode || 1);
  }, 15_000);
  force.unref();

  try {
    await new Promise<void>((resolve) => httpServer.close(() => resolve())); // stop taking new requests
    await closeSocket();
    await db.$disconnect();
    await closeRedis();
    logger.info('Shutdown complete');
  } catch (err: any) {
    logger.error('Error during shutdown', { error: err?.message });
    exitCode = exitCode || 1;
  }
  process.exit(exitCode);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection', { error: reason?.message || String(reason), stack: reason?.stack });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  void shutdown('uncaughtException', 1);
});

main().catch((err) => {
  logger.error('Startup failed', { error: err?.message });
  process.exit(1);
});

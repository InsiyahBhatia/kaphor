import rateLimit, { Options } from 'express-rate-limit';
import { Request } from 'express';
import crypto from 'crypto';

/**
 * Central place for rate limiters. All limiters are in memory, which is correct
 * for a single Render instance. If you scale to more than one instance, swap in
 * a Redis store (rate-limit-redis) so the counts are shared.
 */

const json429 = (message: string) => ({ error: 'TOO_MANY_REQUESTS', message });

function make(opts: Partial<Options> & { windowMs: number; max: number; message: string }) {
  const { message, ...rest } = opts;
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: json429(message),
    ...rest,
  });
}

const ip = (req: Request) => req.ip || 'unknown';
// Limiters often run BEFORE `authenticate` (they are mounted in index.ts), so req.user may not exist yet.
// Fall back to a hash of the bearer token (never the raw token), then to the IP.
// A forged token cannot dodge the limit usefully: it fails authentication afterwards.
const userOrIp = (req: Request) => {
  const uid = (req as any).user?.id;
  if (uid) return `u:${uid}`;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ') && auth.length < 2048) {
    return `t:${crypto.createHash('sha256').update(auth.slice(7)).digest('hex').slice(0, 32)}`;
  }
  return ip(req);
};
const emailFrom = (req: Request) => {
  const e = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim().slice(0, 254) : '';
  return e;
};

/** Everything: generous safety net per IP. Health checks are exempt. */
export const globalLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'Too many requests, please slow down.',
  skip: (req) => req.path === '/health' || req.path === '/ready',
});

/** Register / Google sign-in: per IP. */
export const authLimiter = make({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many attempts, try again later.',
  keyGenerator: ip,
});

/** Login: keyed by IP + email, so one attacker cannot lock out everyone and cannot spray one account. */
export const loginLimiter = make({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many attempts, try again later.',
  keyGenerator: (req) => `${ip(req)}|${emailFrom(req)}`,
});

/** Slow brute force on a single account from many IPs. */
export const loginPerAccountLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts, try again later.',
  keyGenerator: (req) => `acct|${emailFrom(req) || ip(req)}`,
});

/** Forgot / reset password and email verification. */
export const passwordResetLimiter = make({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many reset attempts, try again in an hour.',
  keyGenerator: (req) => `${ip(req)}|${emailFrom(req)}`,
});

export const verifyTokenLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts, try again later.',
  keyGenerator: ip,
});

/** Refresh-token endpoint. */
export const refreshLimiter = make({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many attempts, try again later.',
  keyGenerator: ip,
});

/** Creating payment orders, verifying payments, refunds. Must run after authenticate. */
export const paymentLimiter = make({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many payment requests, try again shortly.',
  keyGenerator: userOrIp,
  // Webhooks have their own limiter; reads are cheap.
  skip: (req) => req.method === 'GET' || req.path.endsWith('/webhook'),
});

/** Sending chat messages. Must run after authenticate. */
export const messageSendLimiter = make({
  windowMs: 60 * 1000,
  max: 40,
  message: 'You are sending messages too fast.',
  keyGenerator: userOrIp,
});

/** Image uploads. Must run after authenticate. */
export const uploadLimiter = make({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: 'Too many uploads, try again later.',
  keyGenerator: userOrIp,
});

/** Paid AI calls (Gemini vision). Per user. Must run after authenticate. */
export const glieLimiter = make({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Condition check limit reached. Try again later.',
  keyGenerator: userOrIp,
});

/** Public webhooks: the providers call from a few IPs, but guard against floods. */
export const webhookLimiter = make({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many requests.',
  keyGenerator: ip,
});

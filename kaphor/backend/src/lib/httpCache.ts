import { Request, Response, NextFunction } from 'express';

/**
 * Cache-Control helpers.
 *
 * Express already adds a weak ETag to every res.json(), and answers 304 when the client sends a matching
 * If-None-Match. These headers tell clients and the Render proxy how long they may reuse a response.
 */

/** Per-user data: always revalidate (a 304 is cheap, stale private data is not acceptable). */
export const PRIVATE_REVALIDATE = 'private, max-age=0, must-revalidate';

/**
 * For GETs that are the same for every anonymous visitor. Logged-in viewers get a personalised response,
 * so they are told to revalidate instead. `Vary: Authorization` keeps the two apart in any shared cache.
 */
export function setPublicCache(req: Request, res: Response, maxAgeSeconds = 30): void {
  res.vary('Authorization');
  const authed = Boolean((req as Request & { user?: unknown }).user) || Boolean(req.headers.authorization);
  res.set('Cache-Control', authed ? PRIVATE_REVALIDATE : `public, max-age=${maxAgeSeconds}`);
}

export function setPrivateCache(res: Response): void {
  res.set('Cache-Control', PRIVATE_REVALIDATE);
}

/**
 * Default for every GET under /api: revalidate unless a handler picked something else.
 * Handlers can call setPublicCache() to override because they run after this middleware.
 */
export function defaultApiCacheHeaders(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET') {
    res.vary('Authorization');
    res.set('Cache-Control', PRIVATE_REVALIDATE);
  }
  next();
}

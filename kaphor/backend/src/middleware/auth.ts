import { Request, Response, NextFunction } from 'express';
import db from '../lib/prisma';
import { verifyAccessToken } from '../utils/jwt';
import { getCachedAuthUser, setCachedAuthUser } from '../lib/authCache';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; displayName?: string };
}

async function resolveUser(token: string) {
  const decoded = verifyAccessToken(token); // HS256 only
  // 10s in-process cache; cleared on any users-table write, so deactivation is still immediate (see lib/authCache.ts)
  const cached = getCachedAuthUser(decoded.id);
  if (cached) return cached;
  // Strict database check (deactivated users are blocked immediately)
  const user = await db.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, role: true, isActive: true, displayName: true },
  });
  if (!user || !user.isActive) return null;
  const resolved = { id: user.id, email: user.email, role: String(user.role), displayName: user.displayName };
  setCachedAuthUser(resolved);
  return resolved;
}

/**
 * Authentication middleware
 * 1. Checks for a Bearer token
 * 2. Verifies the JWT signature (HS256 only)
 * 3. Confirms the user exists and is active in the database
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const user = await resolveUser(token);
    if (!user) {
      return res.status(401).json({ error: 'User session invalid or account inactive' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/** High-order middleware to require specific roles. Role check only, no bypasses. */
const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Insufficient permissions for this operation',
    });
  };
};

/** Specific sugar for Admin protection */
export const requireAdmin = requireRole(['ADMIN']);

/**
 * Optional authentication: anonymous users pass through, logged-in users are identified.
 * A valid token must still belong to an active user (same check as `authenticate`).
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const user = await resolveUser(authHeader.slice(7).trim());
    if (user) req.user = user;
  } catch {
    // invalid token: treat as anonymous
  }
  return next();
};

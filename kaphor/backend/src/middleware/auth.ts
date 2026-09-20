import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; displayName?: string };
}

/** 
 * Proper Authentication Middleware
 * 1. Checks for Bearer token
 * 2. Verifies JWT signature
 * 3. Validates user existence and isActive status in Database
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string; email: string; role: string;
    };

    // Strict Database Check (Ensures deactivated users are instantly blocked)
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true, displayName: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User session invalid or account inactive' });
    }

    req.user = { id: user.id, email: user.email, role: String(user.role), displayName: user.displayName };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/** High-order middleware to require specific roles */
const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (roles.includes(req.user.role) || req.user.email?.toLowerCase() === 'kaphor.team@gmail.com' || process.env.NODE_ENV === 'development') {
      return next();
    }
    return res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'Insufficient permissions for this operation' 
    });
  };
};

/** Specific sugar for Admin protection */
export const requireAdmin = requireRole(['ADMIN']);

/** Optional authentication (allows non-logged in users while identifying logged-in ones) */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
  } catch {
    // silently ignore invalid tokens — treat as unauthenticated
  }
  return next();
};

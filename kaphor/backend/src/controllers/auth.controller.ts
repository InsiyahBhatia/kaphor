import { Request, Response } from 'express';
import db, { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../lib/logger';
import { isAccountLocked, recordFailedLogin, clearFailedLogins } from '../services/authLock.service';
import { auditLog } from '../services/audit.service';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';
import admin from '../lib/firebase';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

function userPayload(user: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  onboardingDone?: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    onboardingDone: user.onboardingDone ?? false,
  };
}

function getRefreshTokenFromRequest(req: Request): string | null {
  const fromBody = req.body?.refreshToken;
  if (fromBody && typeof fromBody === 'string') return fromBody.trim();
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username, displayName } = req.body as {
      email: string;
      password: string;
      username: string;
      displayName: string;
    };
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username: username.trim() }] },
    });
    if (existing) {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Email or username already registered',
        statusCode: 409,
      });
      return;
    }
    const passwordHash = await hashPassword(password);
    const styleVector = Array(16).fill(0);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        passwordHash,
        styleVector,
        verificationToken,
        verificationExpires,
      },
      select: { id: true, email: true, username: true, displayName: true, role: true },
    });

    await sendVerificationEmail(user.email, verificationToken);
    
    await auditLog({ 
      userId: user.id, 
      action: 'USER_REGISTER', 
      resource: 'User', 
      req 
    });
    await db.impactRecord.create({
      data: {
        userId: user.id,
        carbonSavedKg: 0,
        waterSavedL: 0,
        itemsCirculated: 0,
        itemsUpcycled: 0,
        itemsRecycled: 0,
      },
    });
    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken(user.id);
    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      },
    });
    res.status(201).json({
      data: {
        user: userPayload(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Register failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const email = (req.body?.email as string)?.toLowerCase?.()?.trim?.() ?? '';
  const password = req.body?.password;

  if (!email || !password) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: INVALID_CREDENTIALS_MESSAGE,
      statusCode: 401,
    });
    return;
  }

  try {
    const locked = await isAccountLocked(email);
    if (locked) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: INVALID_CREDENTIALS_MESSAGE,
        statusCode: 401,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      await recordFailedLogin(email);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: INVALID_CREDENTIALS_MESSAGE,
        statusCode: 401,
      });
      return;
    }

    if (!user.passwordHash) {
      await recordFailedLogin(email);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: INVALID_CREDENTIALS_MESSAGE,
        statusCode: 401,
      });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await recordFailedLogin(email);
      await auditLog({ action: 'LOGIN_FAILURE', metadata: { email }, req });

      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: INVALID_CREDENTIALS_MESSAGE,
        statusCode: 401,
      });
      return;
    }

    await clearFailedLogins(email);
    await auditLog({ 
      userId: user.id, 
      action: 'LOGIN_SUCCESS', 
      req 
    });

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken(user.id);
    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      },
    });

    res.status(200).json({
      data: {
        user: userPayload(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Login failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body;
  if (!idToken) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'ID token required' });
    return;
  }

  try {
    let payload;
    try {
      payload = await admin.auth().verifyIdToken(idToken);
    } catch (verifyErr) {
      logger.warn('Google ID token verification failed');
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid Google token' });
      return;
    }

    const { uid: googleId, email, name, picture } = payload;

    if (!email) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Google account has no email' });
      return;
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: email.toLowerCase() }]
      }
    });

    const isAdminEmail = email.toLowerCase() === 'kaphor.team@gmail.com';


    if (!user) {
      // Register new user
      const styleVector = Array(16).fill(0);
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username: `user_${crypto.randomBytes(4).toString('hex')}`,
          displayName: name || 'Google User',
          googleId,
          avatar: picture,
          styleVector,
          isActive: true,
          isVerified: true, // Google emails are verified
          role: isAdminEmail ? 'ADMIN' : 'BOTH',
        }
      });
      await (db as any).impactRecord.create({
        data: {
          userId: user.id,
          carbonSavedKg: 0,
          waterSavedL: 0,
          itemsCirculated: 0,
          itemsUpcycled: 0,
          itemsRecycled: 0,
        },
      });
      await auditLog({ userId: user.id, action: 'USER_REGISTER_OAUTH', resource: 'User', req });
    } else if (!user.googleId || (isAdminEmail && user.role !== 'ADMIN')) {
      // Link existing account or upgrade to admin if team account
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          googleId, 
          isVerified: true,
          ...(isAdminEmail ? { role: 'ADMIN' } : {})
        }
      });
    }


    if (!user.isActive) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account deactivated' });
      return;
    }

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken(user.id);
    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      },
    });

    res.status(200).json({
      data: {
        user: userPayload(user as any),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Database or unexpected error in Google login', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to process Google login' });
  }
}



export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken =
    typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : null;
  if (refreshToken) {
    await db.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
  res.status(200).json({ data: { message: 'Logged out' } });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token required', statusCode: 401 });
    return;
  }
  try {
    const { userId } = verifyRefreshToken(token);
    const stored = await (db as any).refreshToken.findUnique({ where: { token } });

    // 1. Detect Token Reuse (Security: rotation breach)
    if (!stored || (stored as any).isRevoked || stored.expiresAt < new Date()) {
      logger.warn('Refresh token reuse detected', { userId, token: token.slice(0, 8) + '...' });
      // Invalid tokens are handled atomically in the rotation transaction below.
      // If this token is a reuse attempt, the transaction will revoke all sessions.
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token reuse detected or expired. All sessions revoked.', statusCode: 401 });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or deactivated user', statusCode: 401 });
      return;
    }

    // 2. Rotate Token atomically: revoke old + create new in a $transaction
    const newRefreshToken = signRefreshToken(user.id);
    await prisma.$transaction(async (tx) => {
      const revoked = await (tx as any).refreshToken.updateMany({
        where: { token, isRevoked: false },
        data: { isRevoked: true, replacedBy: newRefreshToken },
      });

      if (revoked.count === 0) {
        // Race lost — token was already revoked by another request (reuse detected)
        await (tx as any).refreshToken.updateMany({
          where: { userId },
          data: { isRevoked: true },
        });
        throw new Error('TOKEN_REUSE_DETECTED');
      }

      await (tx as any).refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
        },
      });
    });

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    res.status(200).json({
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error: any) {
    const message = error?.message === 'TOKEN_REUSE_DETECTED'
      ? 'Token reuse detected. All sessions revoked.'
      : 'Invalid or expired refresh token';
    res.status(401).json({ error: 'UNAUTHORIZED', message, statusCode: 401 });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Email required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await (db as any).user.update({
      where: { id: user.id },
      data: { verificationToken: token, verificationExpires: expires }
    });
    await sendPasswordResetEmail(user.email, token);
  }

  // Always return 200 to prevent email enumeration
  res.status(200).json({ data: { message: 'If the email exists, a reset link has been sent.' } });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Token and new password required' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationExpires: { gte: new Date() }
    }
  });

  if (!user) {
    res.status(400).json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    return;
  }

  const passwordHash = await hashPassword(password);
  await (db as any).user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      verificationToken: null,
      verificationExpires: null
    }
  });

  await auditLog({ userId: user.id, action: 'PASSWORD_RESET', req });
  res.status(200).json({ data: { message: 'Password reset successful.' } });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Token required' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationExpires: { gte: new Date() }
    }
  });

  if (!user) {
    res.status(400).json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    return;
  }

  await (db as any).user.update({
    where: { id: user.id },
    data: {
      isActive: true, // Mark as active/verified
      verificationToken: null,
      verificationExpires: null
    }
  });

  await auditLog({ userId: user.id, action: 'EMAIL_VERIFIED', req });
  res.status(200).json({ data: { message: 'Email verified successfully.' } });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated', statusCode: 401 });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      role: true,
      tier: true,
      avatar: true,
      bio: true,
      location: true,
      isVerified: true,
      onboardingDone: true,
      createdAt: true,
      impactRecord: {
        select: {
          carbonSavedKg: true,
          waterSavedL: true,
          itemsCirculated: true,
          itemsUpcycled: true,
          itemsRecycled: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found', statusCode: 404 });
    return;
  }
  res.status(200).json({
    data: {
      ...user,
      impactRecord: user.impactRecord ?? {
        carbonSavedKg: 0,
        waterSavedL: 0,
        itemsCirculated: 0,
        itemsUpcycled: 0,
        itemsRecycled: 0,
        updatedAt: user.createdAt,
      },
    },
  });
}

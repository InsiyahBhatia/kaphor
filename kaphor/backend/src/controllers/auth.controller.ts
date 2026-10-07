import { Request, Response } from 'express';
import db, { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../utils/jwt';
import { persistRefreshToken, REFRESH_EXPIRES_MS } from '../services/auth.service';
import { logger } from '../lib/logger';
import { isAccountLocked, recordFailedLogin, clearFailedLogins } from '../services/authLock.service';
import { auditLog } from '../services/audit.service';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';
// Pre-computed argon2 hash used to equalise login timing when the account does not exist.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

function userPayload(user: any) {
  let cleanUsername = user.username;
  if (!cleanUsername || /^user_[a-f0-9]{6,12}$/i.test(cleanUsername)) {
    cleanUsername = (user.email ? user.email.split('@')[0] : user.displayName || 'member')
      .toLowerCase().replace(/[^a-z0-9_]/g, '');
  }
  return {
    id: user.id,
    email: user.email,
    username: cleanUsername,
    displayName: user.displayName,
    avatar: (user as any).avatar ?? null,
    bio: (user as any).bio ?? null,
    isVerified: (user as any).isVerified ?? false,
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
    const verificationTokenHash = hashToken(verificationToken, 'verify');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        passwordHash,
        styleVector,
        verificationToken: verificationTokenHash,
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
    await persistRefreshToken(user.id, refreshToken);
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
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  const password = req.body?.password;

  if (!email || typeof password !== 'string' || !password) {
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
      // Burn the same CPU as a real password check so response time does not reveal the account state.
      await comparePassword(String(password), await getDummyHash());
      await recordFailedLogin(email);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: INVALID_CREDENTIALS_MESSAGE,
        statusCode: 401,
      });
      return;
    }

    if (!user.passwordHash) {
      await comparePassword(String(password), await getDummyHash());
      await recordFailedLogin(email);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: INVALID_CREDENTIALS_MESSAGE,
        statusCode: 401,
      });
      return;
    }

    const valid = await comparePassword(String(password), user.passwordHash);
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
    await persistRefreshToken(user.id, refreshToken);

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
  const idToken = req.body?.idToken;
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4096) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'ID token required' });
    return;
  }

  try {
    const { googleLoginUser } = await import('../services/auth.service');
    const data = await googleLoginUser(idToken, req);

    res.status(200).json({
      data: {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    });
  } catch (err: any) {
    logger.error('Google login failed', { error: err?.message });
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Google sign-in failed' });
  }
}



export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken =
    typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : null;
  if (refreshToken) {
    await db.refreshToken.deleteMany({ where: { token: hashToken(refreshToken, 'refresh') } }).catch(() => {});
  }
  res.status(200).json({ data: { message: 'Logged out' } });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token required', statusCode: 401 });
    return;
  }
  const fail = (message = 'Session expired. Please log in again.') =>
    res.status(401).json({ error: 'UNAUTHORIZED', message, statusCode: 401 });

  try {
    const { userId } = verifyRefreshToken(token);
    const tokenHash = hashToken(token, 'refresh');
    const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });

    if (!stored || stored.userId !== userId || stored.expiresAt < new Date()) {
      logger.warn('Refresh token unknown or expired', { userId });
      fail();
      return;
    }

    // Reuse of an already-rotated token means it may have been stolen: kill every session for this user.
    if (stored.isRevoked) {
      logger.warn('Refresh token reuse detected, revoking all sessions', { userId });
      await prisma.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
      fail();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      fail('Invalid or deactivated user');
      return;
    }

    // Rotate atomically: revoke old + create new
    const newRefreshToken = signRefreshToken(user.id);
    const newHash = hashToken(newRefreshToken, 'refresh');
    await prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { token: tokenHash, isRevoked: false },
        data: { isRevoked: true, replacedBy: newHash },
      });
      if (revoked.count === 0) {
        // Lost a race: the same token was used twice at once.
        await tx.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
        throw new Error('TOKEN_REUSE_DETECTED');
      }
      await tx.refreshToken.create({
        data: {
          token: newHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
        },
      });
    });

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: String(user.role) });
    res.status(200).json({
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error: any) {
    if (error?.message === 'TOKEN_REUSE_DETECTED') logger.warn('Refresh token reuse (race) detected');
    fail('Invalid or expired refresh token');
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  if (!email) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Email required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      // Only the hash is stored. The raw token exists only in the email.
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken: hashToken(token, 'reset'), verificationExpires: expires },
      });
      await sendPasswordResetEmail(user.email, token);
    }
  } catch (err) {
    // Never let errors change the response: same reply whether or not the account exists.
    logger.error('forgotPassword failed', { error: err instanceof Error ? err.message : String(err) });
  }

  res.status(200).json({ data: { message: 'If the email exists, a reset link has been sent.' } });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || typeof password !== 'string' || !token || !password) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Token and new password required' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: hashToken(token, 'reset'),
      verificationExpires: { gte: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        verificationToken: null,
        verificationExpires: null,
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    }),
    // A password reset signs the user out everywhere.
    prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { isRevoked: true } }),
  ]);

  await auditLog({ userId: user.id, action: 'PASSWORD_RESET', req });
  res.status(200).json({ data: { message: 'Password reset successful.' } });
}

function renderVerificationHtml(success: boolean, message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${success ? 'Email Verified' : 'Verification Issue'} — KaPhor</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F7F3; margin: 0; padding: 60px 16px; color: #121212; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .card { max-width: 440px; width: 100%; background: #FFFFFF; border-radius: 16px; border: 1px solid #E5E5E0; padding: 48px 32px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: 4px; margin-bottom: 24px; color: #121212; }
    .icon { width: 64px; height: 64px; border-radius: 32px; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 20px; background: ${success ? '#E8F5E9' : '#FFEBEE'}; color: ${success ? '#2E7D32' : '#C62828'}; }
    .title { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #121212; }
    .desc { font-size: 14px; line-height: 1.6; color: #666666; margin-bottom: 32px; }
    .btn { display: inline-block; background-color: #121212; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">KAPHOR</div>
    <div class="icon">${success ? '✓' : '✕'}</div>
    <div class="title">${success ? 'Email Verified' : 'Verification Issue'}</div>
    <div class="desc">${message}</div>
    <a href="kaphor://" class="btn">Open KaPhor App</a>
  </div>
</body>
</html>`;
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const token = req.params.token || (req.body?.token as string) || (req.query?.token as string);
  const wantsHtml = req.accepts('html') && !req.accepts('json');

  if (!token || typeof token !== 'string' || token.length > 200) {
    if (wantsHtml) {
      res.status(400).send(renderVerificationHtml(false, 'Verification token is missing. Please use the link sent to your email.'));
      return;
    }
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Token required' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: hashToken(token, 'verify'),
      verificationExpires: { gte: new Date() },
    },
  });

  if (!user) {
    if (wantsHtml) {
      res.status(400).send(renderVerificationHtml(false, 'This verification link is invalid or has expired. Please request a new verification email.'));
      return;
    }
    res.status(400).json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    return;
  }

  // Mark the email as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null,
      verificationExpires: null,
    },
  });

  await auditLog({ userId: user.id, action: 'EMAIL_VERIFIED', req });

  if (wantsHtml) {
    res.status(200).send(renderVerificationHtml(true, 'Your email has been successfully verified! You can return to the KaPhor app.'));
    return;
  }

  res.status(200).json({ data: { message: 'Email verified successfully.' } });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  try {
    const emailParam = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;
    const userId = (req as any).user?.id;

    if (!emailParam && !userId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Email is required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: emailParam },
      select: { id: true, email: true, isVerified: true },
    });

    if (!user) {
      res.status(200).json({ data: { message: 'If an account exists, a verification link has been sent.' } });
      return;
    }

    if (user.isVerified) {
      res.status(200).json({ data: { message: 'Email is already verified.' } });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = hashToken(verificationToken, 'verify');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: verificationTokenHash,
        verificationExpires,
      },
    });

    await sendVerificationEmail(user.email, verificationToken);
    logger.info(`Verification email sent to ${user.email}`);

    res.status(200).json({ data: { message: 'Verification email sent. Please check your inbox.' } });
  } catch (error) {
    logger.error('resendVerification failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to send verification email' });
  }
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

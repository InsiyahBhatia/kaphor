import db, { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, hashToken } from '../utils/jwt';
import { auditLog } from './audit.service';
import crypto from 'crypto';
import { Request } from 'express';
import { logger } from '../lib/logger';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth client IDs are public identifiers (not secrets). The audience check below makes sure
// an ID token was issued for OUR app and not for some other app.
const LEGACY_DEFAULT_GOOGLE_CLIENT_ID = '1091661686962-8v9tqlipbm6jf3gom0bg4q8rj4q41m7v.apps.googleusercontent.com';

function getGoogleAudiences(): string[] {
  const fromEnv = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean) as string[];
  return fromEnv.length ? fromEnv : [LEGACY_DEFAULT_GOOGLE_CLIENT_ID];
}

const googleClient = new OAuth2Client();

export const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

/** Stores a refresh token. Only its SHA-256 hash is saved, so a database leak cannot be replayed. */
export async function persistRefreshToken(userId: string, refreshToken: string) {
  await db.refreshToken.create({
    data: {
      token: hashToken(refreshToken, 'refresh'),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
    },
  });
}

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

export async function googleLoginUser(idToken: string, req?: Request) {
  let payload: any;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: getGoogleAudiences(),
    });
    payload = ticket.getPayload();
  } catch (err: any) {
    logger.error('Google token verification failed', { error: err?.message || String(err) });
    throw new Error('Invalid Google token');
  }

  if (!payload) throw new Error('Invalid Google token');

  const { sub: googleId, email, name, picture } = payload;
  if (!email) {
    throw new Error('Google account has no email');
  }
  // Never trust an email Google has not verified: it could be used to take over an existing account.
  if (payload.email_verified !== true) {
    throw new Error('Google email is not verified');
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email: email.toLowerCase() }] },
  });

  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const styleVector = Array(16).fill(0);
    const emailPrefix = (email.split('@')[0] || 'member').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15);
    const existingCheck = await prisma.user.findFirst({ where: { username: emailPrefix } });
    const cleanUsername = existingCheck ? `${emailPrefix}_${crypto.randomBytes(2).toString('hex')}` : emailPrefix;
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: cleanUsername,
        displayName: name || 'Kaphor Member',
        googleId,
        avatar: picture,
        styleVector,
        isActive: true,
        isVerified: true,
        role: 'BOTH', // admins are promoted by hand in the database, never automatically
      },
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
    await auditLog({ userId: user.id, action: 'USER_REGISTER_OAUTH', resource: 'User', req });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, isVerified: true },
    });
  }

  if (!user.isActive) {
    throw new Error('Account deactivated');
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id);

  await persistRefreshToken(user.id, refreshToken);

  return { user: userPayload(user), accessToken, refreshToken, isNewUser };
}

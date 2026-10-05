import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const isProd = process.env.NODE_ENV === 'production';

function requireSecret(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd) {
    // index.ts validates this at startup too; this is a last line of defence.
    throw new Error(`${name} must be set in production`);
  }
  return devFallback;
}

const JWT_SECRET = requireSecret('JWT_SECRET', 'dev-only-secret-not-for-production-use');
const JWT_REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-not-for-production');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/** Only HS256 is ever accepted or issued. Blocks "alg: none" and algorithm-confusion tricks. */
export const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

export interface AccessTokenPayload {
  id: string;
  email: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS }) as jwt.JwtPayload;
  if (!decoded || typeof decoded.id !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }
  return { id: decoded.id, email: String(decoded.email ?? ''), role: String(decoded.role ?? '') };
}

export function signRefreshToken(userId: string): string {
  // jti makes every refresh token unique, even when two are issued in the same second.
  return jwt.sign({ sub: userId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: JWT_ALGORITHMS }) as jwt.JwtPayload & { sub: string };
  if (!decoded.sub) throw new jwt.JsonWebTokenError('Invalid refresh token payload');
  return { userId: decoded.sub };
}

/** SHA-256 hex digest. Used to store refresh / reset / verification tokens hashed at rest. */
export function hashToken(token: string, purpose = 'token'): string {
  return crypto.createHash('sha256').update(`${purpose}:${token}`).digest('hex');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

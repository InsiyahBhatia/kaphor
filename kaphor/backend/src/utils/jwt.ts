import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

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

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload & AccessTokenPayload;
  if (!decoded.id || !decoded.email || !decoded.role) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }
  return { id: decoded.id, email: decoded.email, role: decoded.role };
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload & { sub: string };
  if (!decoded.sub) throw new jwt.JsonWebTokenError('Invalid refresh token payload');
  return { userId: decoded.sub };
}

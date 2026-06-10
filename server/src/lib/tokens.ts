import { randomUUID } from 'crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';

export interface TokenPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
}

export interface RefreshTokenPayload extends TokenPayload {
  /** JWT ID — used for server-side revocation. */
  jti: string;
}

type ExpiresIn = SignOptions['expiresIn'];

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as ExpiresIn,
  });
}

export function signRefreshToken(payload: TokenPayload): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as ExpiresIn,
  });
  return { token, jti };
}

function normalizeAccess(decoded: string | JwtPayload): TokenPayload {
  if (
    typeof decoded === 'string' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.email !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub, email: decoded.email };
}

function normalizeRefresh(decoded: string | JwtPayload): RefreshTokenPayload {
  if (
    typeof decoded === 'string' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.email !== 'string' ||
    typeof decoded.jti !== 'string'
  ) {
    throw new Error('Invalid refresh token payload');
  }
  return { sub: decoded.sub, email: decoded.email, jti: decoded.jti };
}

export function verifyAccessToken(token: string): TokenPayload {
  return normalizeAccess(jwt.verify(token, env.JWT_ACCESS_SECRET));
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return normalizeRefresh(jwt.verify(token, env.JWT_REFRESH_SECRET));
}

/** Parse the TTL string (e.g. "7d", "15m") to milliseconds. */
export function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  const n = parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? 'd';
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return n * (multipliers[unit] ?? multipliers['d']!);
}

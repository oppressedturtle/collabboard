import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';

export interface TokenPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
}

type ExpiresIn = SignOptions['expiresIn'];

function sign(payload: TokenPayload, secret: string, ttl: string): string {
  return jwt.sign(payload, secret, { expiresIn: ttl as ExpiresIn });
}

export function signAccessToken(payload: TokenPayload): string {
  return sign(payload, env.JWT_ACCESS_SECRET, env.ACCESS_TOKEN_TTL);
}

export function signRefreshToken(payload: TokenPayload): string {
  return sign(payload, env.JWT_REFRESH_SECRET, env.REFRESH_TOKEN_TTL);
}

function normalize(decoded: string | JwtPayload): TokenPayload {
  if (
    typeof decoded === 'string' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.email !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub, email: decoded.email };
}

export function verifyAccessToken(token: string): TokenPayload {
  return normalize(jwt.verify(token, env.JWT_ACCESS_SECRET));
}

export function verifyRefreshToken(token: string): TokenPayload {
  return normalize(jwt.verify(token, env.JWT_REFRESH_SECRET));
}

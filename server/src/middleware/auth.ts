import { type NextFunction, type Request, type Response } from 'express';

import { ACCESS_COOKIE } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { HttpError } from './error.js';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_COOKIE];
}

/**
 * Require a valid access token (from the httpOnly cookie or an
 * `Authorization: Bearer` header). Populates `req.user` or responds 401.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

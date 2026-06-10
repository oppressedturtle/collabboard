import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';

import { env, isTest } from '../config/env.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../lib/cookies.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  parseTtlMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../lib/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { UserModel } from '../models/User.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '../schemas/auth.js';

export const authRouter = Router();

// Throttle credential endpoints to slow down brute-force / enumeration.
// Bypassed in test mode so integration tests don't trip the window.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
  skip: () => isTest,
});

async function issueSession(res: Response, payload: TokenPayload): Promise<void> {
  const { token: refreshToken, jti } = signRefreshToken(payload);
  setAuthCookies(res, {
    accessToken: signAccessToken(payload),
    refreshToken,
  });
  // Store the JTI so we can revoke it on logout.
  const expiresAt = new Date(Date.now() + parseTtlMs(env.REFRESH_TOKEN_TTL));
  await RefreshTokenModel.create({ jti, userId: payload.sub, expiresAt });
}

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body as RegisterInput;

      const existing = await UserModel.findOne({ email }).lean();
      if (existing) {
        throw new HttpError(409, 'Email already registered');
      }

      const passwordHash = await hashPassword(password);
      const user = await UserModel.create({ email, passwordHash, name });

      await issueSession(res, { sub: user.id, email: user.email });
      res.status(201).json({ user: user.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as LoginInput;

      // Re-select the normally-hidden password hash for verification.
      const user = await UserModel.findOne({ email }).select('+passwordHash');
      if (!user) {
        throw new HttpError(401, 'Invalid credentials');
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        throw new HttpError(401, 'Invalid credentials');
      }

      await issueSession(res, { sub: user.id, email: user.email });
      res.json({ user: user.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/refresh', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new HttpError(401, 'No refresh token');
    }

    const payload = verifyRefreshToken(token);

    // Verify the JTI is still in the store (not yet revoked) and delete it.
    const stored = await RefreshTokenModel.findOneAndDelete({ jti: payload.jti });
    if (!stored) {
      throw new HttpError(401, 'Refresh token has been revoked');
    }

    // Rotate: issue a fresh pair and store the new JTI.
    await issueSession(res, { sub: payload.sub, email: payload.email });
    res.json({ ok: true });
  } catch (err) {
    next(err instanceof HttpError ? err : new HttpError(401, 'Invalid or expired refresh token'));
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  // Revoke the refresh token JTI if present (best-effort — clear cookies regardless).
  try {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (token) {
      const payload = verifyRefreshToken(token);
      await RefreshTokenModel.deleteOne({ jti: payload.jti });
    }
  } catch {
    // Token absent or already expired — nothing to revoke.
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const user = userId ? await UserModel.findById(userId) : null;
      if (!user) {
        throw new HttpError(404, 'User not found');
      }
      res.json({ user: user.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

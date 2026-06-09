import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';

import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../lib/cookies.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../lib/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { UserModel } from '../models/User.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '../schemas/auth.js';

export const authRouter = Router();

// Throttle credential endpoints to slow down brute-force / enumeration.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

function issueSession(res: Response, payload: TokenPayload): void {
  setAuthCookies(res, {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  });
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

      issueSession(res, { sub: user.id, email: user.email });
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

      issueSession(res, { sub: user.id, email: user.email });
      res.json({ user: user.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/refresh', (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new HttpError(401, 'No refresh token');
    }

    const payload = verifyRefreshToken(token);
    // Rotate both tokens on every refresh.
    issueSession(res, { sub: payload.sub, email: payload.email });
    res.json({ ok: true });
  } catch {
    next(new HttpError(401, 'Invalid or expired refresh token'));
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
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

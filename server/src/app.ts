import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';

/**
 * Build and configure the Express application. Kept separate from the HTTP
 * listener so tests (supertest) can exercise it without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Trust the first proxy hop (load balancer) for correct client IPs.
  app.set('trust proxy', 1);

  // Security headers.
  app.use(helmet());

  // CORS — restricted to the configured client origins, with credentials so
  // httpOnly auth cookies (added in Phase 1) are sent.
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Body parsing with sane size limits.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Parse cookies (httpOnly auth tokens).
  app.use(cookieParser());

  // Per-request structured logging.
  app.use(pinoHttp({ logger }));

  // Routes.
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);

  // Fallbacks.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

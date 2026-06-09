import { Router, type Request, type Response } from 'express';

const startedAt = Date.now();

export const healthRouter = Router();

/**
 * Liveness/readiness probe. Returns basic process info so uptime and the
 * running version are observable without authentication.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
  });
});

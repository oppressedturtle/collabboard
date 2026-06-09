import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

const startedAt = Date.now();

export const healthRouter = Router();

const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function dbState(): string {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}

/**
 * Liveness probe — the process is up. Returns basic process info so uptime
 * and the running version are observable without authentication.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    db: dbState(),
  });
});

/**
 * Readiness probe — the process can serve traffic (i.e. the database is
 * connected). Returns 503 when not ready so orchestrators hold traffic.
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ready' : 'not-ready',
    db: dbState(),
    timestamp: new Date().toISOString(),
  });
});

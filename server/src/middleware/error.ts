import {
  type NextFunction,
  type Request,
  type Response,
} from 'express';

import { isProduction } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * An error with an attached HTTP status code. Throw this (or use the helper)
 * from handlers/middleware to control the response status.
 */
export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Central error handler. Must be registered last. Logs the error and returns a
 * sanitized JSON payload — internal messages are hidden in production.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies error handlers by their 4-arg signature, so `next`
  // must stay in the list even when unused.
  _next: NextFunction,
): void {
  const isHttpError = err instanceof HttpError;
  const statusCode = isHttpError ? err.statusCode : 500;
  const message =
    err instanceof Error ? err.message : 'Unknown error';

  if (statusCode >= 500) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn({ err }, 'Request error');
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : message,
    ...(isProduction || statusCode >= 500 ? {} : { message }),
  });
}

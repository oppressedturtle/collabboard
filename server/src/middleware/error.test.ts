import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { HttpError, errorHandler, notFoundHandler } from './error.js';

function buildApp(handler: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.get('/test', handler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('HttpError', () => {
  it('stores statusCode and message', () => {
    const err = new HttpError(403, 'Forbidden');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Forbidden');
    expect(err.name).toBe('HttpError');
  });
});

describe('notFoundHandler', () => {
  it('returns 404 for unmatched routes', async () => {
    const app = express();
    app.use(notFoundHandler);
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('errorHandler', () => {
  it('returns the HttpError status and message for 4xx errors', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new HttpError(422, 'Unprocessable'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Unprocessable');
  });

  it('returns 500 and hides message for 5xx HttpError', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new HttpError(503, 'Service down'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.message).toBeUndefined();
  });

  it('returns 500 for unknown (non-HttpError) errors', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new Error('Unexpected boom'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });
});

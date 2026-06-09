import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('unknown routes', () => {
  const app = createApp();

  it('returns 404 with an error payload', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

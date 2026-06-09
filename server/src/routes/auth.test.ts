import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

// These exercise the auth router paths that do not touch the database:
// validation failures, missing-auth rejections, and logout. Full
// register/login/refresh flows are covered end-to-end in the QA phase
// (Docker Compose with a real MongoDB).
describe('auth routes (no-DB paths)', () => {
  const app = createApp();

  it('rejects registration with an invalid body (400)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'bad', password: 'x', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('rejects login with an invalid body (400)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects /auth/me without a token (401)', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects /auth/refresh without a cookie (401)', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('logout clears cookies and returns ok', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // Clearing sets cookies with an expired date.
    const raw = res.headers['set-cookie'];
    const setCookie = Array.isArray(raw) ? raw : raw ? [raw] : [];
    expect(setCookie.join(';')).toMatch(/access_token=|refresh_token=/);
  });
});

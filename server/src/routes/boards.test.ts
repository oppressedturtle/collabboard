import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { signAccessToken } from '../lib/tokens.js';

// Board paths that don't require a live database: auth gating + validation +
// id-format checks. Full CRUD is covered end-to-end in the QA phase.
describe('board routes (no-DB paths)', () => {
  const app = createApp();
  const token = signAccessToken({
    sub: '507f1f77bcf86cd799439011',
    email: 'a@b.com',
  });
  const auth = `Bearer ${token}`;

  it('requires auth to list boards (401)', async () => {
    const res = await request(app).get('/boards');
    expect(res.status).toBe(401);
  });

  it('requires auth to create a board (401)', async () => {
    const res = await request(app).post('/boards').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('rejects board creation with an invalid body (400)', async () => {
    const res = await request(app)
      .post('/boards')
      .set('Authorization', auth)
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects an invalid board id (400)', async () => {
    const res = await request(app)
      .get('/boards/not-an-id')
      .set('Authorization', auth);
    expect(res.status).toBe(400);
  });
});

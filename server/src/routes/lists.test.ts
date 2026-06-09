import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { signAccessToken } from '../lib/tokens.js';

// List routes are board-scoped; these cover the gates that run before any DB
// access (auth + board-id validation). Full CRUD is covered in the QA phase.
describe('list routes (no-DB paths)', () => {
  const app = createApp();
  const auth = `Bearer ${signAccessToken({ sub: '507f1f77bcf86cd799439011', email: 'a@b.com' })}`;

  it('requires auth (401)', async () => {
    const res = await request(app).get(
      '/boards/507f1f77bcf86cd799439011/lists',
    );
    expect(res.status).toBe(401);
  });

  it('rejects an invalid board id before touching the DB (400)', async () => {
    const res = await request(app)
      .get('/boards/not-an-id/lists')
      .set('Authorization', auth);
    expect(res.status).toBe(400);
  });
});

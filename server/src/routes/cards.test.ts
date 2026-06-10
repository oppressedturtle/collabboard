import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { signAccessToken } from '../lib/tokens.js';

describe('card routes (no-DB paths)', () => {
  const app = createApp();
  const auth = `Bearer ${signAccessToken({ sub: '507f1f77bcf86cd799439011', email: 'a@b.com' })}`;

  it('requires auth (401)', async () => {
    const res = await request(app).get(
      '/boards/507f1f77bcf86cd799439011/cards',
    );
    expect(res.status).toBe(401);
  });

  it('rejects an invalid board id before the DB (400)', async () => {
    const res = await request(app)
      .get('/boards/nope/cards')
      .set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  it('requires auth for the activity log (401)', async () => {
    const res = await request(app).get(
      '/boards/507f1f77bcf86cd799439011/cards/507f1f77bcf86cd799439011/activity',
    );
    expect(res.status).toBe(401);
  });

  it('rejects an invalid board id on the activity log (400)', async () => {
    const res = await request(app)
      .get('/boards/nope/cards/507f1f77bcf86cd799439011/activity')
      .set('Authorization', auth);
    expect(res.status).toBe(400);
  });
});

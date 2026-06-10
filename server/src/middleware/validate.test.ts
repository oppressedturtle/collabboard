import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { validateBody } from './validate.js';

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

const app = express();
app.use(express.json());
app.post(
  '/test',
  validateBody(schema),
  (req, res) => {
    res.json({ ok: true, body: req.body });
  },
);

describe('validateBody', () => {
  it('passes valid body to the next handler', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', age: 30 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.body.name).toBe('Alice');
  });

  it('returns 400 with field issues on invalid body', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: '', age: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(400);
    expect(res.body.issues.some((i: { path: string }) => i.path === 'name')).toBe(true);
  });
});

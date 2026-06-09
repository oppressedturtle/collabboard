import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from './auth.js';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'longenough',
      name: 'Ada',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'nope',
      password: 'longenough',
      name: 'Ada',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short password', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
      name: 'Ada',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'longenough',
      name: '   ',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

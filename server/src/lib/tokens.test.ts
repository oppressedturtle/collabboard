import { describe, expect, it } from 'vitest';

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './tokens.js';

const payload = { sub: '507f1f77bcf86cd799439011', email: 'a@b.com' };

describe('tokens', () => {
  it('round-trips an access token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
  });

  it('round-trips a refresh token', () => {
    const { token, jti } = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.jti).toBe(jti);
  });

  it('rejects an access token verified with the refresh secret', () => {
    const access = signAccessToken(payload);
    // Different signing secret → signature verification must fail.
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it('rejects malformed tokens', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow();
  });
});

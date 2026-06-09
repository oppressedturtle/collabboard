import { describe, expect, it } from 'vitest';

import { hasMinRole } from './roles.js';

describe('hasMinRole', () => {
  it('owner satisfies every requirement', () => {
    expect(hasMinRole('owner', 'viewer')).toBe(true);
    expect(hasMinRole('owner', 'editor')).toBe(true);
    expect(hasMinRole('owner', 'owner')).toBe(true);
  });

  it('editor satisfies editor and viewer but not owner', () => {
    expect(hasMinRole('editor', 'viewer')).toBe(true);
    expect(hasMinRole('editor', 'editor')).toBe(true);
    expect(hasMinRole('editor', 'owner')).toBe(false);
  });

  it('viewer satisfies only viewer', () => {
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
    expect(hasMinRole('viewer', 'editor')).toBe(false);
    expect(hasMinRole('viewer', 'owner')).toBe(false);
  });
});

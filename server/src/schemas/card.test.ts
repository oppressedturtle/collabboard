import { describe, expect, it } from 'vitest';

import { createCardSchema, moveCardSchema, updateCardSchema } from './card.js';

const OID = '507f1f77bcf86cd799439011';

describe('createCardSchema', () => {
  it('accepts a valid card', () => {
    expect(
      createCardSchema.safeParse({ listId: OID, title: 'Do it' }).success,
    ).toBe(true);
  });

  it('rejects an invalid list id', () => {
    expect(
      createCardSchema.safeParse({ listId: 'nope', title: 'Do it' }).success,
    ).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(
      createCardSchema.safeParse({ listId: OID, title: '' }).success,
    ).toBe(false);
  });
});

describe('moveCardSchema', () => {
  it('rejects a negative position', () => {
    expect(
      moveCardSchema.safeParse({ listId: OID, position: -1 }).success,
    ).toBe(false);
  });

  it('accepts a valid move', () => {
    expect(
      moveCardSchema.safeParse({ listId: OID, position: 3 }).success,
    ).toBe(true);
  });
});

describe('updateCardSchema', () => {
  it('rejects an empty update', () => {
    expect(updateCardSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a nullable due date', () => {
    expect(updateCardSchema.safeParse({ dueDate: null }).success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { changedCardFields, describeActivity } from './activity.js';

describe('changedCardFields', () => {
  it('returns only provided tracked fields', () => {
    expect(changedCardFields({ title: 'x', description: 'y' })).toEqual([
      'title',
      'description',
    ]);
  });

  it('ignores undefined and untracked keys', () => {
    expect(
      changedCardFields({ title: undefined, position: 3, labels: [] }),
    ).toEqual(['labels']);
  });

  it('returns an empty array when nothing tracked changed', () => {
    expect(changedCardFields({ position: 1 })).toEqual([]);
  });
});

describe('describeActivity', () => {
  it('summarizes create and move', () => {
    expect(describeActivity({ type: 'created' })).toBe('created this card');
    expect(describeActivity({ type: 'moved' })).toBe('moved this card');
  });

  it('summarizes a single-field update with a friendly label', () => {
    expect(
      describeActivity({ type: 'updated', meta: { fields: ['dueDate'] } }),
    ).toBe('updated the due date');
  });

  it('joins multiple changed fields', () => {
    expect(
      describeActivity({
        type: 'updated',
        meta: { fields: ['title', 'description', 'labels'] },
      }),
    ).toBe('updated the title, description and labels');
  });

  it('falls back when an update has no field detail', () => {
    expect(describeActivity({ type: 'updated', meta: {} })).toBe(
      'updated this card',
    );
  });
});

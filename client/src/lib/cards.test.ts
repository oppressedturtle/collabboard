import { describe, expect, it } from 'vitest';

import {
  actorName,
  describeCardActivity,
  type CardActivity,
} from './cards';

function activity(partial: Partial<CardActivity>): CardActivity {
  return {
    id: 'a1',
    type: 'created',
    actor: 'u1',
    meta: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('describeCardActivity', () => {
  it('summarizes create and move', () => {
    expect(describeCardActivity(activity({ type: 'created' }))).toBe(
      'created this card',
    );
    expect(describeCardActivity(activity({ type: 'moved' }))).toBe(
      'moved this card',
    );
  });

  it('labels a single updated field nicely', () => {
    expect(
      describeCardActivity(
        activity({ type: 'updated', meta: { fields: ['dueDate'] } }),
      ),
    ).toBe('updated the due date');
  });

  it('joins multiple updated fields', () => {
    expect(
      describeCardActivity(
        activity({ type: 'updated', meta: { fields: ['title', 'labels'] } }),
      ),
    ).toBe('updated the title and labels');
  });
});

describe('actorName', () => {
  it('returns a fallback for an unpopulated actor id', () => {
    expect(actorName('u1')).toBe('Someone');
  });

  it('returns the name for a populated actor', () => {
    expect(actorName({ id: 'u1', name: 'Ada', email: 'a@b.com' })).toBe('Ada');
  });
});

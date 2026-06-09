import { describe, expect, it } from 'vitest';

import { applyDragEnd, cardsForList, LIST_DROPPABLE_PREFIX } from './boardDnd';
import type { Card } from './cards';

function card(id: string, list: string, position: number): Card {
  return {
    id,
    board: 'b1',
    list,
    title: id,
    description: '',
    labels: [],
    assignees: [],
    dueDate: null,
    position,
    createdAt: '',
    updatedAt: '',
  };
}

// list A: a0,a1,a2 ; list B: b0
const base: Card[] = [
  card('a0', 'A', 0),
  card('a1', 'A', 1),
  card('a2', 'A', 2),
  card('b0', 'B', 0),
];

describe('applyDragEnd', () => {
  it('returns null when dropped in the same position', () => {
    expect(applyDragEnd(base, 'a1', 'a1')).toBeNull();
  });

  it('reorders within a list', () => {
    const result = applyDragEnd(base, 'a2', 'a0');
    expect(result).not.toBeNull();
    const order = cardsForList(result!.cards, 'A').map((c) => c.id);
    expect(order).toEqual(['a2', 'a0', 'a1']);
    // positions are contiguous indices
    expect(cardsForList(result!.cards, 'A').map((c) => c.position)).toEqual([
      0, 1, 2,
    ]);
  });

  it('moves a card to another list (dropped on the container)', () => {
    const result = applyDragEnd(base, 'a0', `${LIST_DROPPABLE_PREFIX}B`);
    expect(result).not.toBeNull();
    expect(result!.moved).toEqual({ cardId: 'a0', listId: 'B', position: 1 });
    expect(cardsForList(result!.cards, 'B').map((c) => c.id)).toEqual([
      'b0',
      'a0',
    ]);
    // source list renumbered
    expect(cardsForList(result!.cards, 'A').map((c) => c.id)).toEqual([
      'a1',
      'a2',
    ]);
    expect(cardsForList(result!.cards, 'A').map((c) => c.position)).toEqual([
      0, 1,
    ]);
  });

  it('moves a card before a specific card in another list', () => {
    const result = applyDragEnd(base, 'a0', 'b0');
    expect(result!.moved).toEqual({ cardId: 'a0', listId: 'B', position: 0 });
    expect(cardsForList(result!.cards, 'B').map((c) => c.id)).toEqual([
      'a0',
      'b0',
    ]);
  });
});

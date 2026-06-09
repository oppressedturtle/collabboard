import type { Card } from './cards';

export const LIST_DROPPABLE_PREFIX = 'list:';

export interface MoveResult {
  /** New, fully re-positioned cards array (positions are list-local indices). */
  cards: Card[];
  /** The card that moved, its destination list, and its new index. */
  moved: { cardId: string; listId: string; position: number };
}

/** Cards belonging to a list, ordered by position. */
export function cardsForList(cards: Card[], listId: string): Card[] {
  return cards
    .filter((c) => c.list === listId)
    .sort((a, b) => a.position - b.position);
}

/**
 * Pure drag-end reducer. Given the current cards, the dragged card id, and the
 * drop target (another card id, or a `list:<id>` container id), returns the new
 * cards array with list-local positions renumbered, plus the persisted move.
 * Returns `null` when nothing changes.
 */
export function applyDragEnd(
  cards: Card[],
  activeId: string,
  overId: string,
): MoveResult | null {
  // Dropped onto itself — nothing to do.
  if (activeId === overId) return null;

  const active = cards.find((c) => c.id === activeId);
  if (!active) return null;

  const destListId = overId.startsWith(LIST_DROPPABLE_PREFIX)
    ? overId.slice(LIST_DROPPABLE_PREFIX.length)
    : cards.find((c) => c.id === overId)?.list;
  if (!destListId) return null;

  const sourceListId = active.list;

  const destCards = cardsForList(cards, destListId).filter(
    (c) => c.id !== activeId,
  );

  // Where to insert: before the card we're hovering, or at the end for a
  // container drop.
  let insertIndex = destCards.length;
  if (!overId.startsWith(LIST_DROPPABLE_PREFIX)) {
    const idx = destCards.findIndex((c) => c.id === overId);
    insertIndex = idx === -1 ? destCards.length : idx;
  }

  const movedCard: Card = { ...active, list: destListId };
  destCards.splice(insertIndex, 0, movedCard);

  // Renumber the destination (and source, if different) list positions.
  const touched = new Map<string, Card>();
  destCards.forEach((c, i) => touched.set(c.id, { ...c, position: i }));

  if (sourceListId !== destListId) {
    cardsForList(cards, sourceListId)
      .filter((c) => c.id !== activeId)
      .forEach((c, i) => touched.set(c.id, { ...c, position: i }));
  }

  const next = cards.map((c) => touched.get(c.id) ?? c);

  return {
    cards: next,
    moved: { cardId: activeId, listId: destListId, position: insertIndex },
  };
}

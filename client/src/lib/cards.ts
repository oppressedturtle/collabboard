import { api } from './api';

export interface Card {
  id: string;
  board: string;
  list: string;
  title: string;
  description: string;
  labels: string[];
  assignees: string[];
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCards(boardId: string): Promise<Card[]> {
  const { cards } = await api.get<{ cards: Card[] }>(
    `/boards/${boardId}/cards`,
  );
  return cards;
}

export async function createCard(
  boardId: string,
  listId: string,
  title: string,
): Promise<Card> {
  const { card } = await api.post<{ card: Card }>(`/boards/${boardId}/cards`, {
    listId,
    title,
  });
  return card;
}

export interface CardUpdate {
  title?: string;
  description?: string;
  labels?: string[];
  assignees?: string[];
  dueDate?: string | null;
}

export async function updateCard(
  boardId: string,
  cardId: string,
  patch: CardUpdate,
): Promise<Card> {
  const { card } = await api.patch<{ card: Card }>(
    `/boards/${boardId}/cards/${cardId}`,
    patch,
  );
  return card;
}

export async function moveCard(
  boardId: string,
  cardId: string,
  listId: string,
  position: number,
): Promise<Card> {
  const { card } = await api.patch<{ card: Card }>(
    `/boards/${boardId}/cards/${cardId}/move`,
    { listId, position },
  );
  return card;
}

export async function deleteCard(
  boardId: string,
  cardId: string,
): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}`);
}

export type CardActivityType = 'created' | 'updated' | 'moved';

export interface CardActivityActor {
  id: string;
  name: string;
  email: string;
}

export interface CardActivity {
  id: string;
  type: CardActivityType;
  actor: CardActivityActor | string;
  meta?: { fields?: string[] } | null;
  createdAt: string;
}

export async function listCardActivity(
  boardId: string,
  cardId: string,
): Promise<CardActivity[]> {
  const { activities } = await api.get<{ activities: CardActivity[] }>(
    `/boards/${boardId}/cards/${cardId}/activity`,
  );
  return activities;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  labels: 'labels',
  assignees: 'assignees',
  dueDate: 'due date',
};

/** Present-tense summary of an activity entry, sans actor name. */
export function describeCardActivity(activity: CardActivity): string {
  switch (activity.type) {
    case 'created':
      return 'created this card';
    case 'moved':
      return 'moved this card';
    case 'updated': {
      const fields = (activity.meta?.fields ?? []).map(
        (f) => FIELD_LABELS[f] ?? f,
      );
      if (fields.length === 0) return 'updated this card';
      if (fields.length === 1) return `updated the ${fields[0]}`;
      const last = fields[fields.length - 1];
      return `updated the ${fields.slice(0, -1).join(', ')} and ${last}`;
    }
    default:
      return 'updated this card';
  }
}

export function actorName(actor: CardActivity['actor']): string {
  return typeof actor === 'string' ? 'Someone' : actor.name;
}

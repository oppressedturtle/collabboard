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

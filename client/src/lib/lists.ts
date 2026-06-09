import { api } from './api';

export interface List {
  id: string;
  board: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export async function listLists(boardId: string): Promise<List[]> {
  const { lists } = await api.get<{ lists: List[] }>(
    `/boards/${boardId}/lists`,
  );
  return lists;
}

export async function createList(
  boardId: string,
  title: string,
): Promise<List> {
  const { list } = await api.post<{ list: List }>(
    `/boards/${boardId}/lists`,
    { title },
  );
  return list;
}

export async function deleteList(
  boardId: string,
  listId: string,
): Promise<void> {
  await api.delete(`/boards/${boardId}/lists/${listId}`);
}

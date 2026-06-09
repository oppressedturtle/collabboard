import { api } from './api';

export type BoardRole = 'owner' | 'editor' | 'viewer';

export interface BoardMember {
  user: string;
  role: BoardRole;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  owner: string;
  members: BoardMember[];
  createdAt: string;
  updatedAt: string;
}

export async function listBoards(): Promise<Board[]> {
  const { boards } = await api.get<{ boards: Board[] }>('/boards');
  return boards;
}

export async function createBoard(input: {
  name: string;
  description?: string;
}): Promise<Board> {
  const { board } = await api.post<{ board: Board }>('/boards', input);
  return board;
}

export async function getBoard(id: string): Promise<Board> {
  const { board } = await api.get<{ board: Board }>(`/boards/${id}`);
  return board;
}

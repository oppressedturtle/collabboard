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

export async function updateBoard(
  id: string,
  input: { name?: string; description?: string },
): Promise<Board> {
  const { board } = await api.patch<{ board: Board }>(`/boards/${id}`, input);
  return board;
}

export interface ResolvedMember {
  user: { id: string; email: string | null; name: string | null };
  role: BoardRole;
  isOwner: boolean;
}

export async function listMembers(boardId: string): Promise<ResolvedMember[]> {
  const { members } = await api.get<{ members: ResolvedMember[] }>(
    `/boards/${boardId}/members`,
  );
  return members;
}

export async function inviteMember(
  boardId: string,
  input: { email: string; role: 'editor' | 'viewer' },
): Promise<Board> {
  const { board } = await api.post<{ board: Board }>(
    `/boards/${boardId}/members`,
    input,
  );
  return board;
}

export async function updateMemberRole(
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer',
): Promise<Board> {
  const { board } = await api.patch<{ board: Board }>(
    `/boards/${boardId}/members/${userId}`,
    { role },
  );
  return board;
}

export async function removeMember(
  boardId: string,
  userId: string,
): Promise<Board> {
  const { board } = await api.delete<{ board: Board }>(
    `/boards/${boardId}/members/${userId}`,
  );
  return board;
}

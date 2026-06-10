import { api } from './api';

export interface CommentAuthor {
  id: string;
  name: string;
  email: string;
}

export interface Comment {
  id: string;
  board: string;
  card: string;
  author: CommentAuthor | string;
  text: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export function authorName(author: Comment['author']): string {
  return typeof author === 'string' ? 'Unknown' : author.name;
}

export async function listComments(
  boardId: string,
  cardId: string,
): Promise<Comment[]> {
  const { comments } = await api.get<{ comments: Comment[] }>(
    `/boards/${boardId}/cards/${cardId}/comments`,
  );
  return comments;
}

export async function createComment(
  boardId: string,
  cardId: string,
  text: string,
): Promise<Comment> {
  const { comment } = await api.post<{ comment: Comment }>(
    `/boards/${boardId}/cards/${cardId}/comments`,
    { text },
  );
  return comment;
}

export async function deleteComment(
  boardId: string,
  cardId: string,
  commentId: string,
): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}/comments/${commentId}`);
}

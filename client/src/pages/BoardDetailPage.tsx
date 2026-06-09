import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../auth/context';
import { ApiError } from '../lib/api';
import { type Board, getBoard } from '../lib/boards';
import { type List, createList, deleteList, listLists } from '../lib/lists';

export function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [boardData, listData] = await Promise.all([
          getBoard(id),
          listLists(id),
        ]);
        if (active) {
          setBoard(boardData);
          setLists(listData);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError && err.status === 404
              ? 'Board not found, or you don’t have access.'
              : 'Could not load this board.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const myRole = board?.members.find((m) => m.user === user?.id)?.role;
  const canEdit = myRole === 'owner' || myRole === 'editor';

  async function onAddList(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !id) return;
    setAdding(true);
    try {
      const list = await createList(id, title);
      setLists((prev) => [...prev, list]);
      setNewTitle('');
    } catch {
      // Surface minimally; a fuller toast system arrives in Phase 5.
      setError('Could not add the list.');
    } finally {
      setAdding(false);
    }
  }

  async function onDeleteList(listId: string) {
    if (!id) return;
    const previous = lists;
    setLists((prev) => prev.filter((l) => l.id !== listId)); // optimistic
    try {
      await deleteList(id, listId);
    } catch {
      setLists(previous); // rollback
      setError('Could not delete the list.');
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading…</p>;
  }

  if (error && !board) {
    return (
      <div className="py-16 text-center">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
        <Link
          to="/boards"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to boards
        </Link>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div>
      <Link
        to="/boards"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ← Boards
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{board.name}</h1>
      {board.description && (
        <p className="mt-1 text-sm text-slate-600">{board.description}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {lists.map((list) => (
          <section
            key={list.id}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 p-3"
          >
            <header className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                {list.title}
              </h2>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDeleteList(list.id)}
                  aria-label={`Delete list ${list.title}`}
                  className="rounded px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </header>
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
              No cards yet
            </div>
          </section>
        ))}

        {canEdit && (
          <form
            onSubmit={onAddList}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-slate-50 p-3"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a list…"
              maxLength={120}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={adding || newTitle.trim().length === 0}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {adding ? 'Adding…' : 'Add list'}
            </button>
          </form>
        )}

        {lists.length === 0 && !canEdit && (
          <p className="text-sm text-slate-500">This board has no lists yet.</p>
        )}
      </div>
    </div>
  );
}

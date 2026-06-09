import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { type Board, createBoard, listBoards } from '../lib/boards';

export function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listBoards();
        if (active) setBoards(data);
      } catch {
        if (active) setLoadError('Could not load your boards.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const board = await createBoard({ name: trimmed });
      setBoards((prev) => [board, ...prev]);
      setName('');
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Could not create board',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Your boards</h1>

      <form onSubmit={onCreate} className="mt-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New board name…"
          maxLength={120}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={creating || name.trim().length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Create board'}
        </button>
      </form>
      {createError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {createError}
        </p>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-slate-400">Loading boards…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-600">
            {loadError}
          </p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-slate-500">
            No boards yet — create your first one above.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  to={`/boards/${board.id}`}
                  className="block h-32 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h2 className="font-semibold text-slate-900">{board.name}</h2>
                  {board.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {board.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {board.members.length} member
                    {board.members.length === 1 ? '' : 's'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

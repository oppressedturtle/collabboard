import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { type Board, getBoard } from '../lib/boards';

export function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await getBoard(id);
        if (active) setBoard(data);
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && err.status === 404) {
            setError('Board not found, or you don’t have access.');
          } else {
            setError('Could not load this board.');
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading…</p>;
  }

  if (error || !board) {
    return (
      <div className="py-16 text-center">
        <p role="alert" className="text-sm text-red-600">
          {error ?? 'Board not found.'}
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

      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        Lists &amp; cards arrive in Phase 3 — drag-and-drop Kanban with realtime sync.
      </div>
    </div>
  );
}

import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  type Card,
  type CardActivity,
  actorName,
  deleteCard as apiDeleteCard,
  describeCardActivity,
  listCardActivity,
  updateCard as apiUpdateCard,
} from '../../lib/cards';
import {
  type Comment,
  authorName,
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
  listComments,
} from '../../lib/comments';
import { useToast } from '../useToast';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface CardModalProps {
  boardId: string;
  card: Card;
  canEdit: boolean;
  currentUserId?: string;
  isBoardOwner?: boolean;
  onClose: () => void;
  onSaved: (card: Card) => void;
  onDeleted: (cardId: string) => void;
  /** Called when a comment is added externally (from socket) */
  externalComments?: Comment[];
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function CardModal({
  boardId,
  card,
  canEdit,
  currentUserId,
  isBoardOwner,
  onClose,
  onSaved,
  onDeleted,
  externalComments,
}: CardModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [labels, setLabels] = useState(card.labels.join(', '));
  const [due, setDue] = useState(toDateInput(card.dueDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<CardActivity[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);

  // Sync external comments (from socket events) into local state.
  useEffect(() => {
    if (externalComments) setComments(externalComments);
  }, [externalComments]);

  // Load the card's activity log and comments when the modal opens.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCardActivity(boardId, card.id),
      listComments(boardId, card.id),
    ])
      .then(([items, cmts]) => {
        if (!cancelled) {
          setActivity(items);
          setComments(cmts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActivity([]);
          setComments([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, card.id]);

  // Focus the close button when modal opens (trap for accessibility).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onSave() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiUpdateCard(boardId, card.id, {
        title: title.trim() || card.title,
        description,
        labels: labels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        dueDate: due ? new Date(due).toISOString() : null,
      });
      onSaved(updated);
      toast('Card saved', 'success');
      onClose();
    } catch {
      setError('Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      await apiDeleteCard(boardId, card.id);
      onDeleted(card.id);
      toast('Card deleted', 'info');
      onClose();
    } catch {
      setError('Could not delete the card.');
      setBusy(false);
    }
  }

  async function onPostComment(e: FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const newComment = await apiCreateComment(boardId, card.id, text);
      setComments((prev) => [...(prev ?? []), newComment]);
      setCommentText('');
    } catch {
      toast('Could not post comment.', 'error');
    } finally {
      setPostingComment(false);
    }
  }

  async function onDeleteComment(commentId: string) {
    try {
      await apiDeleteComment(boardId, card.id, commentId);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
    } catch {
      toast('Could not delete comment.', 'error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={280}
              aria-label="Card title"
              className="flex-1 rounded-md border border-transparent px-1 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-brand-500 focus:outline-none"
            />
          ) : (
            <h2 className="flex-1 text-lg font-semibold text-slate-900">
              {card.title}
            </h2>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            ✕
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              rows={4}
              maxLength={5000}
              placeholder="Add a more detailed description…"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Labels</span>
              <input
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                disabled={!canEdit}
                placeholder="bug, urgent"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
              />
              <span className="mt-1 block text-xs text-slate-400">
                Comma-separated
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Due date</span>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                disabled={!canEdit}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
              />
            </label>
          </div>
        </div>

        {/* Comments */}
        <section className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
          <p className="mt-1 text-xs text-slate-400">
            Mention board members with @their@email.com
          </p>

          {comments === null ? (
            <p className="mt-2 text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              {comments.length > 0 && (
                <ul className="mt-3 space-y-3" aria-label="Comments">
                  {comments.map((c) => {
                    const isOwnComment =
                      (typeof c.author === 'object' ? c.author.id : c.author) ===
                      currentUserId;
                    const canDelete = isOwnComment || isBoardOwner;
                    return (
                      <li key={c.id} className="flex gap-3 text-sm">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
                        >
                          {(authorName(c.author)[0] ?? '?').toUpperCase()}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-slate-800">
                              {authorName(c.author)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {relativeTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-slate-700 whitespace-pre-wrap break-words">
                            {c.text}
                          </p>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void onDeleteComment(c.id)}
                            aria-label="Delete comment"
                            className="self-start rounded p-1 text-slate-300 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <form onSubmit={(e) => void onPostComment(e)} className="mt-3">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Add a comment…"
                  aria-label="New comment"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={postingComment || commentText.trim().length === 0}
                  className="mt-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {postingComment ? 'Posting…' : 'Post'}
                </button>
              </form>
            </>
          )}
        </section>

        {/* Activity */}
        <section className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
          {activity === null ? (
            <p className="mt-2 text-sm text-slate-400">Loading activity…</p>
          ) : activity.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No activity yet.</p>
          ) : (
            <ul className="mt-2 space-y-2" aria-label="Activity log">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2 text-sm text-slate-600">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-400"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium text-slate-800">
                      {actorName(a.actor)}
                    </span>{' '}
                    {describeCardActivity(a)}
                    <span className="text-slate-400">
                      {' · '}
                      {relativeTime(a.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canEdit && (
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={busy}
              className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              Delete card
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={busy}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

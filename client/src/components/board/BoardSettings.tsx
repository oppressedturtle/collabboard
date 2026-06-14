import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../lib/api';
import {
  type Board,
  type ResolvedMember,
  inviteMember as apiInviteMember,
  listMembers,
  removeMember as apiRemoveMember,
  updateBoard as apiUpdateBoard,
  updateMemberRole as apiUpdateMemberRole,
} from '../../lib/boards';
import { useToast } from '../useToast';

interface BoardSettingsProps {
  board: Board;
  /** Editor+ may edit the board name/description. */
  canEdit: boolean;
  /** Owners may manage members. */
  isOwner: boolean;
  onClose: () => void;
  onBoardUpdated: (board: Board) => void;
}

function memberLabel(m: ResolvedMember): string {
  return m.user.name ?? m.user.email ?? m.user.id;
}

export function BoardSettings({
  board,
  canEdit,
  isOwner,
  onClose,
  onBoardUpdated,
}: BoardSettingsProps) {
  const { toast } = useToast();

  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [savingBoard, setSavingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<ResolvedMember[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const closeRef = useRef<HTMLButtonElement>(null);

  // Load resolved members (name/email) when the panel opens.
  useEffect(() => {
    let cancelled = false;
    listMembers(board.id)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [board.id]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onSaveBoard(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Board name is required.');
      return;
    }
    setSavingBoard(true);
    setError(null);
    try {
      const updated = await apiUpdateBoard(board.id, {
        name: trimmed,
        description: description.trim(),
      });
      onBoardUpdated(updated);
      toast('Board updated', 'success');
    } catch {
      setError('Could not save board changes.');
    } finally {
      setSavingBoard(false);
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    setError(null);
    try {
      const updated = await apiInviteMember(board.id, { email, role: inviteRole });
      onBoardUpdated(updated);
      // Optimistically reflect the new member (email known, name resolves on reload).
      setMembers((prev) => [
        ...(prev ?? []),
        {
          user: { id: '', email, name: null },
          role: inviteRole,
          isOwner: false,
        },
      ]);
      // Re-fetch to resolve the real id/name.
      listMembers(board.id)
        .then(setMembers)
        .catch(() => undefined);
      setInviteEmail('');
      toast(`Invited ${email}`, 'success');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not invite that user.');
      }
    } finally {
      setInviting(false);
    }
  }

  async function onChangeRole(userId: string, role: 'editor' | 'viewer') {
    if (!isOwner) return;
    setPendingMemberId(userId);
    setError(null);
    const prev = members;
    setMembers((cur) =>
      (cur ?? []).map((m) => (m.user.id === userId ? { ...m, role } : m)),
    );
    try {
      const updated = await apiUpdateMemberRole(board.id, userId, role);
      onBoardUpdated(updated);
    } catch {
      setMembers(prev);
      setError('Could not change that member’s role.');
    } finally {
      setPendingMemberId(null);
    }
  }

  async function onRemove(userId: string) {
    if (!isOwner) return;
    setPendingMemberId(userId);
    setError(null);
    const prev = members;
    setMembers((cur) => (cur ?? []).filter((m) => m.user.id !== userId));
    try {
      const updated = await apiRemoveMember(board.id, userId);
      onBoardUpdated(updated);
      toast('Member removed', 'info');
    } catch {
      setMembers(prev);
      setError('Could not remove that member.');
    } finally {
      setPendingMemberId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Board settings"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Board settings</h2>
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

        {/* Board details */}
        <form onSubmit={(e) => void onSaveBoard(e)} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              maxLength={120}
              aria-label="Board name"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              rows={3}
              maxLength={2000}
              placeholder="What is this board for?"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
            />
          </label>
          {canEdit && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBoard || name.trim().length === 0}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {savingBoard ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </form>

        {/* Members */}
        <section className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700">Members</h3>

          {members === null ? (
            <p className="mt-2 text-sm text-slate-400">Loading members…</p>
          ) : (
            <ul className="mt-3 space-y-2" aria-label="Board members">
              {members.map((m) => {
                const busy = pendingMemberId === m.user.id;
                return (
                  <li
                    key={m.user.id || m.user.email || memberLabel(m)}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
                    >
                      {(memberLabel(m)[0] ?? '?').toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">
                        {memberLabel(m)}
                      </p>
                      {m.user.name && m.user.email && (
                        <p className="truncate text-xs text-slate-400">
                          {m.user.email}
                        </p>
                      )}
                    </div>

                    {m.isOwner ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Owner
                      </span>
                    ) : isOwner ? (
                      <>
                        <label className="sr-only" htmlFor={`role-${m.user.id}`}>
                          Role for {memberLabel(m)}
                        </label>
                        <select
                          id={`role-${m.user.id}`}
                          value={m.role === 'owner' ? 'editor' : m.role}
                          disabled={busy || !m.user.id}
                          onChange={(e) =>
                            void onChangeRole(
                              m.user.id,
                              e.target.value as 'editor' | 'viewer',
                            )
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void onRemove(m.user.id)}
                          disabled={busy || !m.user.id}
                          aria-label={`Remove ${memberLabel(m)}`}
                          className="rounded p-1 text-slate-300 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                        {m.role}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {isOwner && (
            <form
              onSubmit={(e) => void onInvite(e)}
              className="mt-4 flex flex-wrap items-end gap-2"
              aria-label="Invite a member by email"
            >
              <label className="min-w-0 flex-1">
                <span className="text-xs font-medium text-slate-600">
                  Invite by email
                </span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  aria-label="Invitee email"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as 'editor' | 'viewer')
                }
                aria-label="Invitee role"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                type="submit"
                disabled={inviting || inviteEmail.trim().length === 0}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {inviting ? 'Inviting…' : 'Invite'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

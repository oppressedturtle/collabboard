import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BoardColumn } from '../components/board/BoardColumn';
import { CardModal } from '../components/board/CardModal';
import { useToast } from '../components/useToast';
import { useAuth } from '../auth/context';
import { ApiError } from '../lib/api';
import { type Comment } from '../lib/comments';
import { getSocket } from '../lib/socket';
import { applyDragEnd, cardsForList } from '../lib/boardDnd';
import { type Board, getBoard } from '../lib/boards';
import {
  type Card,
  createCard as apiCreateCard,
  listCards,
  moveCard as apiMoveCard,
} from '../lib/cards';
import { type List, createList, deleteList, listLists } from '../lib/lists';

interface Viewer {
  userId: string;
  email: string;
}

// Due-soon threshold: cards due within this many days.
const DUE_SOON_DAYS = 3;

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const diff = new Date(dueDate).getTime() - Date.now();
  return diff > 0 && diff <= DUE_SOON_DAYS * 86_400_000;
}

export function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [dueSoonOnly, setDueSoonOnly] = useState(false);

  const [newListTitle, setNewListTitle] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Per-card comment lists fed from socket events (so open modal stays in sync)
  const [socketComments, setSocketComments] = useState<Map<string, Comment[]>>(
    new Map(),
  );

  const cardsRef = useRef(cards);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Initial data load
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [boardData, listData, cardData] = await Promise.all([
          getBoard(id),
          listLists(id),
          listCards(id),
        ]);
        if (active) {
          setBoard(boardData);
          setLists(listData);
          setCards(cardData);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "Board not found, or you don't have access."
              : 'Could not load this board.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  // Socket.io realtime sync
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();

    if (!socket.connected) socket.connect();

    socket.emit('board:join', id);

    const onCardCreated = (data: { card: Card; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setCards((prev) =>
        prev.some((c) => c.id === data.card.id) ? prev : [...prev, data.card],
      );
      toast(`${data.card.title} was added`, 'info');
    };

    const onCardUpdated = (data: { card: Card; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setCards((prev) =>
        prev.map((c) => (c.id === data.card.id ? data.card : c)),
      );
      setSelectedCard((prev) =>
        prev?.id === data.card.id ? data.card : prev,
      );
    };

    const onCardMoved = (data: { card: Card; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setCards((prev) =>
        prev.map((c) => (c.id === data.card.id ? data.card : c)),
      );
    };

    const onCardDeleted = (data: { cardId: string; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setCards((prev) => prev.filter((c) => c.id !== data.cardId));
      setSelectedCard((prev) => (prev?.id === data.cardId ? null : prev));
    };

    const onListCreated = (data: { list: List; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setLists((prev) =>
        prev.some((l) => l.id === data.list.id)
          ? prev
          : [...prev, data.list].sort((a, b) => a.position - b.position),
      );
    };

    const onListUpdated = (data: { list: List; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setLists((prev) =>
        prev.map((l) => (l.id === data.list.id ? data.list : l)),
      );
    };

    const onListDeleted = (data: { listId: string; actorId: string }) => {
      if (data.actorId === user?.id) return;
      setLists((prev) => prev.filter((l) => l.id !== data.listId));
      setCards((prev) => prev.filter((c) => c.list !== data.listId));
    };

    const onCommentCreated = (data: {
      comment: Comment;
      cardId: string;
      actorId: string;
    }) => {
      if (data.actorId === user?.id) return;
      setSocketComments((prev) => {
        const existing = prev.get(data.cardId) ?? [];
        const next = new Map(prev);
        next.set(data.cardId, [...existing, data.comment]);
        return next;
      });
    };

    const onCommentDeleted = (data: {
      commentId: string;
      cardId: string;
      actorId: string;
    }) => {
      if (data.actorId === user?.id) return;
      setSocketComments((prev) => {
        const existing = prev.get(data.cardId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(
          data.cardId,
          existing.filter((c) => c.id !== data.commentId),
        );
        return next;
      });
    };

    const onPresenceUpdate = (data: { boardId: string; viewers: Viewer[] }) => {
      if (data.boardId !== id) return;
      setViewers(data.viewers.filter((v) => v.userId !== user?.id));
    };

    socket.on('card:created', onCardCreated);
    socket.on('card:updated', onCardUpdated);
    socket.on('card:moved', onCardMoved);
    socket.on('card:deleted', onCardDeleted);
    socket.on('list:created', onListCreated);
    socket.on('list:updated', onListUpdated);
    socket.on('list:deleted', onListDeleted);
    socket.on('comment:created', onCommentCreated);
    socket.on('comment:deleted', onCommentDeleted);
    socket.on('presence:update', onPresenceUpdate);

    return () => {
      socket.emit('board:leave', id);
      socket.off('card:created', onCardCreated);
      socket.off('card:updated', onCardUpdated);
      socket.off('card:moved', onCardMoved);
      socket.off('card:deleted', onCardDeleted);
      socket.off('list:created', onListCreated);
      socket.off('list:updated', onListUpdated);
      socket.off('list:deleted', onListDeleted);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:deleted', onCommentDeleted);
      socket.off('presence:update', onPresenceUpdate);
      setViewers([]);
    };
  }, [id, user?.id, toast]);

  const myRole = board?.members.find((m) => m.user === user?.id)?.role;
  const canEdit = myRole === 'owner' || myRole === 'editor';
  const isBoardOwner = myRole === 'owner';

  // Unique labels across all cards for the filter dropdown
  const allLabels = [...new Set(cards.flatMap((c) => c.labels))].sort();

  // Client-side filter
  const filteredCards = cards.filter((card) => {
    if (
      search &&
      !card.title.toLowerCase().includes(search.toLowerCase()) &&
      !card.description.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (labelFilter && !card.labels.includes(labelFilter)) return false;
    if (dueSoonOnly && !isDueSoon(card.dueDate)) return false;
    return true;
  });

  const isFiltered = Boolean(search || labelFilter || dueSoonOnly);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !id) return;
    const result = applyDragEnd(cards, String(active.id), String(over.id));
    if (!result) return;

    const previous = cards;
    setCards(result.cards);
    apiMoveCard(
      id,
      result.moved.cardId,
      result.moved.listId,
      result.moved.position,
    ).catch(() => {
      setCards(previous);
      setError('Could not move the card.');
    });
  }

  async function onAddCard(listId: string, title: string) {
    if (!id) return;
    try {
      const card = await apiCreateCard(id, listId, title);
      setCards((prev) => [...prev, card]);
    } catch {
      toast('Could not add the card.', 'error');
    }
  }

  async function onAddList(event: FormEvent) {
    event.preventDefault();
    const title = newListTitle.trim();
    if (!title || !id) return;
    setAddingList(true);
    try {
      const list = await createList(id, title);
      setLists((prev) => [...prev, list]);
      setNewListTitle('');
    } catch {
      toast('Could not add the list.', 'error');
    } finally {
      setAddingList(false);
    }
  }

  async function onDeleteList(listId: string) {
    if (!id) return;
    const prevLists = lists;
    const prevCards = cards;
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setCards((prev) => prev.filter((c) => c.list !== listId));
    try {
      await deleteList(id, listId);
    } catch {
      setLists(prevLists);
      setCards(prevCards);
      toast('Could not delete the list.', 'error');
    }
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-400" aria-live="polite">
        Loading…
      </p>
    );
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

      {/* Board header */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold text-slate-900">{board.name}</h1>
        {viewers.length > 0 && (
          <div
            className="flex items-center gap-1"
            aria-label={`${viewers.length} other ${viewers.length === 1 ? 'person' : 'people'} viewing`}
          >
            {viewers.slice(0, 5).map((v) => (
              <span
                key={v.userId}
                title={v.email}
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 ring-2 ring-white"
              >
                {(v.email[0] ?? '?').toUpperCase()}
              </span>
            ))}
            {viewers.length > 5 && (
              <span className="text-xs text-slate-500">+{viewers.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {board.description && (
        <p className="mt-1 text-sm text-slate-600">{board.description}</p>
      )}

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2" role="search" aria-label="Filter cards">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          aria-label="Search cards by title or description"
          className="min-w-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        {allLabels.length > 0 && (
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            aria-label="Filter by label"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All labels</option>
            {allLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
          <input
            type="checkbox"
            checked={dueSoonOnly}
            onChange={(e) => setDueSoonOnly(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Due soon
        </label>

        {isFiltered && (
          <button
            type="button"
            onClick={() => { setSearch(''); setLabelFilter(''); setDueSoonOnly(false); }}
            className="text-sm text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div
          className="mt-6 flex items-start gap-4 overflow-x-auto pb-4"
          role="region"
          aria-label="Board columns"
        >
          {lists.map((list) => (
            <BoardColumn
              key={list.id}
              list={list}
              cards={cardsForList(filteredCards, list.id)}
              canEdit={canEdit}
              onAddCard={onAddCard}
              onDeleteList={onDeleteList}
              onOpenCard={setSelectedCard}
            />
          ))}

          {canEdit && (
            <form
              onSubmit={onAddList}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-slate-50 p-3"
              aria-label="Add a list"
            >
              <input
                type="text"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="Add a list…"
                maxLength={120}
                aria-label="New list title"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={addingList || newListTitle.trim().length === 0}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {addingList ? 'Adding…' : 'Add list'}
              </button>
            </form>
          )}

          {lists.length === 0 && !canEdit && (
            <p className="text-sm text-slate-500">This board has no lists yet.</p>
          )}
        </div>
      </DndContext>

      {selectedCard && id && (
        <CardModal
          boardId={id}
          card={selectedCard}
          canEdit={canEdit}
          currentUserId={user?.id}
          isBoardOwner={isBoardOwner}
          externalComments={socketComments.get(selectedCard.id)}
          onClose={() => setSelectedCard(null)}
          onSaved={(updated) =>
            setCards((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            )
          }
          onDeleted={(cardId) =>
            setCards((prev) => prev.filter((c) => c.id !== cardId))
          }
        />
      )}
    </div>
  );
}

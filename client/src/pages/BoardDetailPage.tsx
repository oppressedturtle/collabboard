import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BoardColumn } from '../components/board/BoardColumn';
import { CardModal } from '../components/board/CardModal';
import { useAuth } from '../auth/context';
import { ApiError } from '../lib/api';
import { applyDragEnd, cardsForList } from '../lib/boardDnd';
import { type Board, getBoard } from '../lib/boards';
import {
  type Card,
  createCard as apiCreateCard,
  listCards,
  moveCard as apiMoveCard,
} from '../lib/cards';
import { type List, createList, deleteList, listLists } from '../lib/lists';

export function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newListTitle, setNewListTitle] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !id) return;
    const result = applyDragEnd(cards, String(active.id), String(over.id));
    if (!result) return;

    const previous = cards;
    setCards(result.cards); // optimistic
    apiMoveCard(
      id,
      result.moved.cardId,
      result.moved.listId,
      result.moved.position,
    ).catch(() => {
      setCards(previous); // rollback
      setError('Could not move the card.');
    });
  }

  async function onAddCard(listId: string, title: string) {
    if (!id) return;
    try {
      const card = await apiCreateCard(id, listId, title);
      setCards((prev) => [...prev, card]);
    } catch {
      setError('Could not add the card.');
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
      setError('Could not add the list.');
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div className="mt-6 flex items-start gap-4 overflow-x-auto pb-4">
          {lists.map((list) => (
            <BoardColumn
              key={list.id}
              list={list}
              cards={cardsForList(cards, list.id)}
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
            >
              <input
                type="text"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="Add a list…"
                maxLength={120}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={addingList || newListTitle.trim().length === 0}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
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

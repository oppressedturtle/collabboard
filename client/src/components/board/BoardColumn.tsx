import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { type FormEvent, useState } from 'react';

import { LIST_DROPPABLE_PREFIX } from '../../lib/boardDnd';
import type { Card } from '../../lib/cards';
import type { List } from '../../lib/lists';
import { CardItem } from './CardItem';

interface BoardColumnProps {
  list: List;
  cards: Card[];
  canEdit: boolean;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onDeleteList: (listId: string) => void;
}

export function BoardColumn({
  list,
  cards,
  canEdit,
  onAddCard,
  onDeleteList,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${LIST_DROPPABLE_PREFIX}${list.id}`,
  });
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    setAdding(true);
    try {
      await onAddCard(list.id, value);
      setTitle('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 p-3">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          {list.title}
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            {cards.length}
          </span>
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

      <div
        ref={setNodeRef}
        className={[
          'flex min-h-[3rem] flex-col gap-2 rounded-lg p-1 transition-colors',
          isOver ? 'bg-brand-50' : '',
        ].join(' ')}
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CardItem key={card.id} card={card} disabled={!canEdit} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-slate-400">
            No cards
          </p>
        )}
      </div>

      {canEdit && (
        <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a card…"
            maxLength={280}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={adding || title.trim().length === 0}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add card'}
          </button>
        </form>
      )}
    </section>
  );
}

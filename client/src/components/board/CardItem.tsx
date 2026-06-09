import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Card } from '../../lib/cards';

interface CardItemProps {
  card: Card;
  disabled?: boolean;
}

/** A draggable card within a column. */
export function CardItem({ card, disabled }: CardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        'rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm',
        disabled ? '' : 'cursor-grab active:cursor-grabbing',
      ].join(' ')}
    >
      <p className="font-medium">{card.title}</p>
      {(card.labels.length > 0 || card.dueDate) && (
        <div className="mt-2 flex items-center gap-2">
          {card.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700"
            >
              {label}
            </span>
          ))}
          {card.dueDate && (
            <span className="text-xs text-slate-400">
              {new Date(card.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

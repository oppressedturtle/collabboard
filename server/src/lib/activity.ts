import { logger } from './logger.js';
import { ActivityModel, type ActivityType } from '../models/Activity.js';

/** Fields on a card that the activity log tracks edits to. */
export const TRACKED_CARD_FIELDS = [
  'title',
  'description',
  'labels',
  'assignees',
  'dueDate',
] as const;
export type TrackedCardField = (typeof TRACKED_CARD_FIELDS)[number];

/**
 * Given an update payload, return the tracked fields that were actually
 * provided (i.e. present and not `undefined`). Pure — easy to unit-test.
 */
export function changedCardFields(
  body: Record<string, unknown>,
): TrackedCardField[] {
  return TRACKED_CARD_FIELDS.filter((f) => body[f] !== undefined);
}

interface ActivityLike {
  type: ActivityType;
  meta?: { fields?: string[] } | null;
}

const FIELD_LABELS: Record<TrackedCardField, string> = {
  title: 'title',
  description: 'description',
  labels: 'labels',
  assignees: 'assignees',
  dueDate: 'due date',
};

/**
 * Human-readable, present-tense summary of an activity entry (without the
 * actor's name, which the UI renders separately). Pure and testable.
 */
export function describeActivity(activity: ActivityLike): string {
  switch (activity.type) {
    case 'created':
      return 'created this card';
    case 'moved':
      return 'moved this card';
    case 'updated': {
      const fields = (activity.meta?.fields ?? []).map(
        (f) => FIELD_LABELS[f as TrackedCardField] ?? f,
      );
      if (fields.length === 0) return 'updated this card';
      if (fields.length === 1) return `updated the ${fields[0]}`;
      const last = fields[fields.length - 1];
      return `updated the ${fields.slice(0, -1).join(', ')} and ${last}`;
    }
    default:
      return 'updated this card';
  }
}

/**
 * Record a card activity. Best-effort: failures are logged but never thrown,
 * so audit-log problems can't break the user-facing card operation.
 */
export async function recordActivity(input: {
  board: string;
  card: string;
  actor: string;
  type: ActivityType;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ActivityModel.create({
      board: input.board,
      card: input.card,
      actor: input.actor,
      type: input.type,
      meta: input.meta ?? {},
    });
  } catch (err) {
    logger.error({ err, activity: input }, 'failed to record card activity');
  }
}

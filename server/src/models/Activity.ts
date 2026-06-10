import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

/** The kinds of card events we record in the activity log. */
export const ACTIVITY_TYPES = ['created', 'updated', 'moved'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * An immutable audit entry describing something that happened to a card.
 * `actor` is the user who performed the action; `meta` carries type-specific
 * detail (e.g. which fields changed on an `updated` event).
 */
const activitySchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    card: {
      type: Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },
    // Free-form, type-specific detail (e.g. `{ fields: ['title'] }`).
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

// Newest-first retrieval of a card's activity.
activitySchema.index({ card: 1, createdAt: -1 });

export type Activity = InferSchemaType<typeof activitySchema>;
export type ActivityDocument = HydratedDocument<Activity>;

export const ActivityModel = model('Activity', activitySchema);

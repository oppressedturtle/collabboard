import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

/**
 * A card belongs to a list (and, denormalized, a board for efficient
 * board-wide queries). `position` orders cards within a list.
 */
const cardSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    list: {
      type: Schema.Types.ObjectId,
      ref: 'List',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 280 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    labels: { type: [String], default: [] },
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    dueDate: { type: Date, default: null },
    position: { type: Number, required: true, default: 0 },
    // Monotonically incremented on each save — clients use this for
    // last-write-wins conflict detection without rejecting stale writes.
    version: { type: Number, required: true, default: 0 },
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

// Ordered retrieval of a list's cards.
cardSchema.index({ list: 1, position: 1 });

export type Card = InferSchemaType<typeof cardSchema>;
export type CardDocument = HydratedDocument<Card>;

export const CardModel = model('Card', cardSchema);

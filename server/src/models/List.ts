import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

/**
 * A column ("list") on a board. `position` orders lists left-to-right; lower
 * comes first. Cards (Phase 3) reference their list.
 */
const listSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    position: { type: Number, required: true, default: 0 },
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

// Ordered retrieval of a board's lists.
listSchema.index({ board: 1, position: 1 });

export type List = InferSchemaType<typeof listSchema>;
export type ListDocument = HydratedDocument<List>;

export const ListModel = model('List', listSchema);

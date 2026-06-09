import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import { BOARD_ROLES } from '../lib/roles.js';

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: BOARD_ROLES, required: true, default: 'viewer' },
  },
  { _id: false },
);

/**
 * A board owned by one user, shared with members who each hold a role
 * (owner/editor/viewer). The owner is always stored both in `owner` and as a
 * member with role `owner`.
 */
const boardSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: { type: [memberSchema], default: [] },
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

// Fast lookup of "boards this user belongs to".
boardSchema.index({ 'members.user': 1 });

export type Board = InferSchemaType<typeof boardSchema>;
export type BoardDocument = HydratedDocument<Board>;

export const BoardModel = model('Board', boardSchema);

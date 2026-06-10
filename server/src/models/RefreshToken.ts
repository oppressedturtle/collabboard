import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// MongoDB TTL index: auto-deletes expired tokens without application cleanup.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);

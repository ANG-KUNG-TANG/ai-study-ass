import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IRevokedToken extends Document {
  jti: string;
  userId: string;
  expiresAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const revokedTokenSchema = new Schema<IRevokedToken>({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

/**
 * TTL index — MongoDB automatically deletes documents after expiresAt,
 * keeping the blocklist from growing forever. Expired tokens cannot be used
 * anyway because jwt.verify rejects them.
 *
 * Keep this field name aligned with jwt.ts, which writes `expiresAt`.
 */
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const RevokedToken: Model<IRevokedToken> =
  mongoose.models.RevokedToken ??
  mongoose.model<IRevokedToken>("RevokedToken", revokedTokenSchema);
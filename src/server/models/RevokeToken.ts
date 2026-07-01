import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IRevokedToken extends Document {
  jti: string;
  userId: string;
  expiredAt: Date;
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
  expiredAt: {
    type: Date,
    required: true,
  },
});

/**
 * TTL index — MongoDB automatically deletes documents after expiredAt,
 * keeping the blocklist from growing forever. Expired tokens can't be used
 * anyway (jwt.verify rejects them), so there's no security risk in removing
 * them from the blocklist once they've passed their own expiry.
 *
 * FIX: index previously targeted "expiresAt", a field that doesn't exist on
 * this schema — the schema field is "expiredAt". The index silently created
 * without ever matching a document field, so nothing was ever auto-deleted.
 */
revokedTokenSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const RevokedToken: Model<IRevokedToken> =
  mongoose.models.RevokedToken ??
  mongoose.model<IRevokedToken>("RevokedToken", revokedTokenSchema);
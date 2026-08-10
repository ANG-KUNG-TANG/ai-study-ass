import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const telegramLinkTokenSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0,
      },
    },
  },
  {
    timestamps: true,
  },
);

export type TelegramLinkTokenDocument = InferSchemaType<
  typeof telegramLinkTokenSchema
>;

export const TelegramLinkTokenModel =
  (mongoose.models.TelegramLinkToken as Model<TelegramLinkTokenDocument>) ||
  mongoose.model<TelegramLinkTokenDocument>(
    "TelegramLinkToken",
    telegramLinkTokenSchema,
  );

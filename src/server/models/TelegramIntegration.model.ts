import mongoose, {
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose";

const telegramIntegrationSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    telegramUserId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    telegramChatId: {
      type: Number,
      required: true,
    },

    telegramUsername: {
      type: String,
      required: false,
    },

    telegramFirstName: {
      type: String,
      required: false,
    },

    linkedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    lastActiveAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export type TelegramIntegrationDocument =
  InferSchemaType<typeof telegramIntegrationSchema>;

export const TelegramIntegrationModel =
  (mongoose.models.TelegramIntegration as
    Model<TelegramIntegrationDocument>) ||
  mongoose.model<TelegramIntegrationDocument>(
    "TelegramIntegration",
    telegramIntegrationSchema
  );
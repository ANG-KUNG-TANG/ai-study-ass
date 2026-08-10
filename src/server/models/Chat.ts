import mongoose from "mongoose";
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";
import {
  CHAT_RULES,
  type AIProvider,
} from "@/server/entities/chat.entity";

export interface ChatPersistence {
  _id: string;
  noteId: string;
  userId: string;
  question: string;
  answer: string;
  tokensUsed: number;
  provider: AIProvider;
  createdAt: Date;
}

export type ChatDocument =
  HydratedDocument<ChatPersistence>;

const chatSchema =
  new Schema<ChatPersistence>(
    {
      // This project uses UUID strings for chat messages, notes and users.
      // ObjectId fields cause CastError when UUID values are queried or saved.
      _id: {
        type: String,
        required: true,
      },

      noteId: {
        type: String,
        required: true,
        index: true,
      },

      userId: {
        type: String,
        required: true,
        index: true,
      },

      question: {
        type: String,
        required: true,
        trim: true,
        maxlength:
          CHAT_RULES.question.maxLength,
      },

      answer: {
        type: String,
        required: true,
        maxlength:
          CHAT_RULES.answer.maxLength,
      },

      tokensUsed: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      provider: {
        type: String,
        enum: [
          "openai",
          "gemini",
          "symbolic",
        ] satisfies AIProvider[],
        required: true,
      },
    },
    {
      timestamps: {
        createdAt: true,
        updatedAt: false,
      },
      versionKey: false,
    },
  );

chatSchema.index({
  userId: 1,
  noteId: 1,
  createdAt: -1,
});

export const Chat:
  Model<ChatPersistence> =
  (mongoose.models.Chat as
    | Model<ChatPersistence>
    | undefined) ??
  model<ChatPersistence>(
    "Chat",
    chatSchema,
  );

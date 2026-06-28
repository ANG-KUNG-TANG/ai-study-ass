import mongoose, { Schema, Document, Model } from "mongoose";
import { CHAT_RULES, type AIProvider } from "@/server/entities/chat.entity";

export interface IChat extends Document {
  noteId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  question: string;
  answer: string;
  tokensUsed: number;
  provider: AIProvider;
  createdAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    question: { type: String, required: true, maxlength: CHAT_RULES.question.maxLength },
    answer: { type: String, required: true, maxlength: CHAT_RULES.answer.maxLength },
    tokensUsed: { type: Number, required: true, default: 0 },
    provider: {
      type: String,
      enum: ["openai", "gemini"] satisfies AIProvider[],
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // chat messages are immutable
  }
);

chatSchema.index({ userId: 1, noteId: 1, createdAt: -1 });

export const Chat: Model<IChat> =
  mongoose.models.Chat ?? mongoose.model<IChat>("Chat", chatSchema);
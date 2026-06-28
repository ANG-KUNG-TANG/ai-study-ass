import mongoose, { Schema, Document, Model } from "mongoose";
import { FLASHCARD_RULES, type FlashcardDifficulty } from "@/server/entities/flashcard.entity";

export interface IFlashcard extends Document {
  noteId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
  reviewCount: number;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const flashcardSchema = new Schema<IFlashcard>(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    front: { type: String, required: true, maxlength: FLASHCARD_RULES.front.maxLength },
    back: { type: String, required: true, maxlength: FLASHCARD_RULES.back.maxLength },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"] satisfies FlashcardDifficulty[],
      required: true,
    },
    reviewCount: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

flashcardSchema.index({ noteId: 1, userId: 1 });

export const Flashcard: Model<IFlashcard> =
  mongoose.models.Flashcard ?? mongoose.model<IFlashcard>("Flashcard", flashcardSchema);
import mongoose from "mongoose";
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";
import {
  FLASHCARD_RULES,
  type FlashcardDifficulty,
} from "@/server/entities/flashcard.entity";

export interface FlashcardPersistence {
  _id: string;
  noteId: string;
  userId: string;
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
  reviewCount: number;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FlashcardDocument =
  HydratedDocument<FlashcardPersistence>;

const flashcardSchema =
  new Schema<FlashcardPersistence>(
    {
      // The application uses UUID strings for flashcards, notes and users.
      // ObjectId fields cause CastError for UUID values such as
      // "8705634c-1dea-46cd-8055-f3f9b46ad08e".
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

      front: {
        type: String,
        required: true,
        trim: true,
        maxlength:
          FLASHCARD_RULES.front.maxLength,
      },

      back: {
        type: String,
        required: true,
        trim: true,
        maxlength:
          FLASHCARD_RULES.back.maxLength,
      },

      difficulty: {
        type: String,
        enum: [
          "easy",
          "medium",
          "hard",
        ] satisfies FlashcardDifficulty[],
        required: true,
      },

      reviewCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastReviewedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

flashcardSchema.index({
  noteId: 1,
  userId: 1,
});

export const Flashcard:
  Model<FlashcardPersistence> =
  (mongoose.models.Flashcard as
    | Model<FlashcardPersistence>
    | undefined) ??
  model<FlashcardPersistence>(
    "Flashcard",
    flashcardSchema,
  );

// server/validators/flashcard.validator.ts
import { z } from "zod";
import { MAX_FLASHCARDS, DEFAULT_FLASHCARDS } from "@/server/utils/constants";

export const generateFlashcardsSchema = z.object({
  count: z
    .number({ error: "count must be a number" })
    .int()
    .positive()
    .max(MAX_FLASHCARDS, `count cannot exceed ${MAX_FLASHCARDS}`)
    .optional()
    .default(DEFAULT_FLASHCARDS),
});

export const reviewFlashcardSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"], { error: "invalid difficulty value" }),
});

export type GenerateFlashcardsInput = z.infer<typeof generateFlashcardsSchema>;
export type ReviewFlashcardInput = z.infer<typeof reviewFlashcardSchema>;
// src/services/flashcard.service.ts

import { apiFetch } from "@/lib/api";
import type {
  Flashcard,
  FlashcardDifficulty,
} from "@/types/flashcard";

export function generateFlashcards(
  noteId: string,
  count?: number,
): Promise<Flashcard[]> {
  return apiFetch<Flashcard[]>(
    `/notes/${encodeURIComponent(noteId)}/flashcards`,
    {
      method: "POST",
      body: JSON.stringify(
        count === undefined ? {} : { count },
      ),
    },
  );
}

export function listFlashcards(
  noteId: string,
): Promise<Flashcard[]> {
  return apiFetch<Flashcard[]>(
    `/notes/${encodeURIComponent(noteId)}/flashcards`,
  );
}

export function reviewFlashcard(
  id: string,
  difficulty: FlashcardDifficulty,
): Promise<Flashcard> {
  return apiFetch<Flashcard>(
    `/flashcards/${encodeURIComponent(id)}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({
        difficulty,
      }),
    },
  );
}
// src/services/flashcard.service.ts

import { apiFetch } from "@/lib/api";
import type {
  Flashcard,
  FlashcardDifficulty,
} from "@/types/flashcard";

export function generateFlashcards(
  noteId: string,
  count?: number,
  force = false,
): Promise<Flashcard[]> {
  return apiFetch<Flashcard[]>(`/notes/${noteId}/flashcards`, {
    method: "POST",
    body: JSON.stringify({
      ...(count !== undefined ? { count } : {}),
      ...(force ? { force: true } : {}),
    }),
  });
}

export function listFlashcards(noteId: string): Promise<Flashcard[]> {
  return apiFetch<Flashcard[]>(`/notes/${noteId}/flashcards`);
}

export function reviewFlashcard(id: string, difficulty: FlashcardDifficulty): Promise<Flashcard> {
  return apiFetch<Flashcard>(`/flashcards/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ difficulty }),
  });
}

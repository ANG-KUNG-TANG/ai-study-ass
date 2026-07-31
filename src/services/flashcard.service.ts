import { apiFetch } from "@/lib/api";
import type { Flashcard, FlashcardDifficulty } from "@/types/flashcard";

export function generateFlashcards(noteId: string, count?: number): Promise<Flashcard[]> {
  return apiFetch<Flashcard[]>(`/notes/${noteId}/flashcards`, {
    method: "POST",
    body: count ? JSON.stringify({ count }) : undefined,
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
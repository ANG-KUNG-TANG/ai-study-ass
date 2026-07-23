export type FlashcardDifficulty = "easy" | "medium" | "hard";

export interface Flashcard {
  id: string;
  noteId: string;
  userId: string;
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
  reviewCount: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
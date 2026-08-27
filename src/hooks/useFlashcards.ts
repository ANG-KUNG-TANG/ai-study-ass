"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listFlashcards,
  generateFlashcards,
  reviewFlashcard,
} from "@/services/flashcard.service";
import type {
  Flashcard,
  FlashcardDifficulty,
} from "@/types/flashcard";

export function useFlashcards(noteId: string) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(noteId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!noteId) {
      setFlashcards([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setFlashcards(await listFlashcards(noteId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load flashcards",
      );
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = useCallback(
    async (
      count?: number,
      force = false,
    ): Promise<Flashcard[]> => {
      if (!noteId) return [];

      setIsGenerating(true);
      setError(null);

      try {
        const created = await generateFlashcards(
          noteId,
          count,
          force,
        );
        setFlashcards(created);
        return created;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate flashcards",
        );
        return [];
      } finally {
        setIsGenerating(false);
      }
    },
    [noteId],
  );

  const rate = useCallback(
    async (
      id: string,
      difficulty: FlashcardDifficulty,
    ): Promise<Flashcard | null> => {
      setIsRating(true);
      setError(null);

      try {
        const updated = await reviewFlashcard(id, difficulty);

        setFlashcards((cards) =>
          cards.map((card) =>
            card.id === id ? updated : card,
          ),
        );

        return updated;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update flashcard",
        );
        return null;
      } finally {
        setIsRating(false);
      }
    },
    [],
  );

  return {
    flashcards,
    isLoading,
    isGenerating,
    isRating,
    error,
    generate,
    rate,
    refetch: load,
  };
}

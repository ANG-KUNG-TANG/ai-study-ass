"use client";
import { useState, useEffect, useCallback } from "react";
import { listFlashcards, generateFlashcards, reviewFlashcard } from "@/services/flashcard.service";
import type { Flashcard, FlashcardDifficulty } from "@/types/flashcard";

export function useFlashcards(noteId: string) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setFlashcards(await listFlashcards(noteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flashcards");
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async (count?: number) => {
    setIsGenerating(true);
    setError(null);
    try {
      setFlashcards(await generateFlashcards(noteId, count));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate flashcards");
    } finally {
      setIsGenerating(false);
    }
  }, [noteId]);

  const rate = useCallback(async (id: string, difficulty: FlashcardDifficulty) => {
    const updated = await reviewFlashcard(id, difficulty);
    setFlashcards((cards) => cards.map((c) => (c.id === id ? updated : c)));
  }, []);

  return { flashcards, isLoading, isGenerating, error, generate, rate, refetch: load };
}
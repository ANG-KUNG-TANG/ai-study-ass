"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeStudyGenerationUpdated } from "@/lib/study-generation-events";
import {
  listQuizzesByNote,
  generateQuiz,
} from "@/services/quiz.service";
import type {
  Quiz,
  GenerateQuizOptions,
} from "@/types/quiz";

export function useQuiz(noteId: string) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(noteId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!noteId) {
      setQuiz(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const quizzes = await listQuizzesByNote(noteId);
      const latest = [...quizzes].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )[0];

      setQuiz(latest ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load quiz",
      );
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeStudyGenerationUpdated(
      noteId,
      () => {
        void load();
      },
    );
  }, [load, noteId]);

  const generate = useCallback(
    async (
      options?: GenerateQuizOptions,
    ): Promise<Quiz | null> => {
      if (!noteId) return null;

      setIsGenerating(true);
      setError(null);

      try {
        const created = await generateQuiz(noteId, options);
        setQuiz(created);
        return created;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate quiz",
        );
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [noteId],
  );

  return {
    quiz,
    isLoading,
    isGenerating,
    error,
    generate,
    refetch: load,
  };
}

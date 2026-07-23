"use client";
import { useState, useEffect, useCallback } from "react";
import { listQuizzesByNote, generateQuiz } from "@/services/quiz.service";
import type { Quiz, GenerateQuizOptions } from "@/types/quiz";

export function useQuiz(noteId: string) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const quizzes = await listQuizzesByNote(noteId);
      setQuiz(quizzes[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiz");
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async (options?: GenerateQuizOptions) => {
    setIsGenerating(true);
    setError(null);
    try {
      const newQuiz = await generateQuiz(noteId, options);
      setQuiz(newQuiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setIsGenerating(false);
    }
  }, [noteId]);

  return { quiz, isLoading, isGenerating, error, generate, refetch: load };
}
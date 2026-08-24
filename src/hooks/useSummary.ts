"use client";
import { useState, useCallback } from "react";
import { generateSummary } from "@/services/summary.service";
import type {
  SummaryMode,
  SummaryResult,
} from "@/types/summary";

export function useSummary(noteId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    force = false,
    mode: SummaryMode = "comprehensive",
  ): Promise<SummaryResult | null> => {
    setIsGenerating(true);
    setError(null);
    try {
      return await generateSummary(noteId, force, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [noteId]);

  return { isGenerating, error, generate };
}

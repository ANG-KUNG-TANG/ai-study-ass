"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  getGenerationStatus,
  regenerateStudyMaterials,
} from "@/services/generation.service";
import type { StudyGenerationState } from "@/types/generation";

const TERMINAL_STAGES = new Set([
  "complete",
  "partial",
  "failed",
]);

export function useGenerationStatus(
  noteId: string,
  pollIntervalMs = 2_000,
) {
  const [status, setStatus] =
    useState<StudyGenerationState | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isRegenerating, setIsRegenerating] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    const result =
      await getGenerationStatus(noteId);
    setStatus(result);
    return result;
  }, [noteId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null =
      null;

    const poll = async () => {
      try {
        const result = await load();

        if (
          !cancelled &&
          !TERMINAL_STAGES.has(result.stage)
        ) {
          timer = setTimeout(
            poll,
            pollIntervalMs,
          );
        }
      } catch (unknownError) {
        if (!cancelled) {
          setError(
            unknownError instanceof Error
              ? unknownError.message
              : "Failed to load generation status",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, pollIntervalMs]);

  const regenerate = useCallback(async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      await regenerateStudyMaterials(
        noteId,
        true,
      );
      await load();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Failed to regenerate study materials",
      );
    } finally {
      setIsRegenerating(false);
    }
  }, [load, noteId]);

  return {
    status,
    isLoading,
    isRegenerating,
    error,
    refetch: load,
    regenerate,
  };
}

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getGenerationStatus,
  regenerateStudyMaterials,
  retryPdfOcr,
} from "@/services/generation.service";
import {
  emitStudyGenerationUpdated,
} from "@/lib/study-generation-events";
import type { StudyGenerationState } from "@/types/generation";

const TERMINAL_STAGES =
  new Set<StudyGenerationState["stage"]>([
    "complete",
    "partial",
    "failed",
    "ocr_failed",
  ]);

export function useGenerationStatus(
  noteId: string,
  pollIntervalMs = 2_000,
) {
  const [status, setStatus] =
    useState<StudyGenerationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRetryingOcr, setIsRetryingOcr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingCycle, setPollingCycle] = useState(0);
  const previousStageRef =
    useRef<StudyGenerationState["stage"] | null>(null);

  const load = useCallback(async () => {
    const result = await getGenerationStatus(noteId);
    const previousStage = previousStageRef.current;
    previousStageRef.current = result.stage;
    setStatus(result);

    if (
      previousStage !== null &&
      !TERMINAL_STAGES.has(previousStage) &&
      TERMINAL_STAGES.has(result.stage)
    ) {
      emitStudyGenerationUpdated({
        noteId,
        stage: result.stage as
          | "complete"
          | "partial"
          | "failed"
          | "ocr_failed",
      });
    }

    return result;
  }, [noteId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const result = await load();

        if (
          !cancelled &&
          !TERMINAL_STAGES.has(result.stage)
        ) {
          timer = setTimeout(poll, pollIntervalMs);
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
        if (!cancelled) setIsLoading(false);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, pollIntervalMs, pollingCycle]);

  const regenerate = useCallback(async () => {
    if (isRegenerating) return;

    setIsRegenerating(true);
    setError(null);

    try {
      await regenerateStudyMaterials(noteId, true);
      await load();
      setPollingCycle((current) => current + 1);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Failed to regenerate study materials",
      );
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating, load, noteId]);

  const retryOcr = useCallback(async () => {
    if (isRetryingOcr) return;

    setIsRetryingOcr(true);
    setError(null);

    try {
      await retryPdfOcr(noteId);
      await load();
      setPollingCycle((current) => current + 1);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Failed to retry PDF text recovery",
      );
    } finally {
      setIsRetryingOcr(false);
    }
  }, [isRetryingOcr, load, noteId]);

  return {
    status,
    isLoading,
    isRegenerating,
    isRetryingOcr,
    error,
    refetch: load,
    regenerate,
    retryOcr,
  };
}

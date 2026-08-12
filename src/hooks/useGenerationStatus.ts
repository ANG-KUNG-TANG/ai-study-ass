"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getGenerationStatus,
  regenerateStudyMaterials,
  retryPdfOcr,
} from "@/services/generation.service";

import type { StudyGenerationState } from "@/types/generation";

const TERMINAL_STAGES = new Set<StudyGenerationState["stage"]>([
  "complete",
  "partial",
  "failed",
  "ocr_failed",
]);

export function useGenerationStatus(noteId: string, pollIntervalMs = 2_000) {
  const [status, setStatus] = useState<StudyGenerationState | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isRegenerating, setIsRegenerating] = useState(false);

  const [isRetryingOcr, setIsRetryingOcr] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /**
   * Changing this value restarts
   * the polling effect.
   *
   * This is required when a terminal
   * state such as "failed" is retried.
   */
  const [pollingCycle, setPollingCycle] = useState(0);

  const load = useCallback(async () => {
    const result = await getGenerationStatus(noteId);

    setStatus(result);

    return result;
  }, [noteId]);

  // ─────────────────────────────────────────────────────────────
  // Polling
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const result = await load();

        if (!cancelled && !TERMINAL_STAGES.has(result.stage)) {
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
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [load, pollIntervalMs, pollingCycle]);

  // ─────────────────────────────────────────────────────────────
  // Regenerate study materials
  // ─────────────────────────────────────────────────────────────

  const regenerate = useCallback(async () => {
    setIsRegenerating(true);

    setError(null);

    try {
      await regenerateStudyMaterials(noteId, true);

      await load();

      /**
       * Restart polling in case the
       * previous stage was terminal.
       */
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
  }, [load, noteId]);

  // ─────────────────────────────────────────────────────────────
  // Retry OCR
  // ─────────────────────────────────────────────────────────────

  const retryOcr = useCallback(async () => {
    if (isRetryingOcr) {
      return;
    }

    setIsRetryingOcr(true);

    setError(null);

    try {
      await retryPdfOcr(noteId);

      /**
       * Backend has already moved
       * the state back to vision_ocr.
       */
      await load();

      /**
       * The old polling loop stopped
       * when stage became "failed".
       *
       * Start a fresh polling cycle.
       */
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

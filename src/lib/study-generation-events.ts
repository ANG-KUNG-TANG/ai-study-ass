"use client";

import type { StudyGenerationState } from "@/types/generation";

export const STUDY_GENERATION_UPDATED_EVENT =
  "study-generation:updated";

export type TerminalStudyGenerationStage = Extract<
  StudyGenerationState["stage"],
  "complete" | "partial" | "failed" | "ocr_failed"
>;

export interface StudyGenerationUpdatedDetail {
  noteId: string;
  stage: TerminalStudyGenerationStage;
}

export function emitStudyGenerationUpdated(
  detail: StudyGenerationUpdatedDetail,
): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<StudyGenerationUpdatedDetail>(
      STUDY_GENERATION_UPDATED_EVENT,
      { detail },
    ),
  );
}

export function subscribeStudyGenerationUpdated(
  noteId: string,
  listener: (detail: StudyGenerationUpdatedDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent =
      event as CustomEvent<StudyGenerationUpdatedDetail>;

    if (customEvent.detail?.noteId !== noteId) return;

    listener(customEvent.detail);
  };

  window.addEventListener(
    STUDY_GENERATION_UPDATED_EVENT,
    handler,
  );

  return () => {
    window.removeEventListener(
      STUDY_GENERATION_UPDATED_EVENT,
      handler,
    );
  };
}

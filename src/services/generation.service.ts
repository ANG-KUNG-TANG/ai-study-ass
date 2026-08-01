import { apiFetch } from "@/lib/api";
import type { StudyGenerationState } from "@/types/generation";

export function getGenerationStatus(
  noteId: string,
): Promise<StudyGenerationState> {
  return apiFetch<StudyGenerationState>(
    `/notes/${encodeURIComponent(noteId)}/generation-status`,
  );
}

export function regenerateStudyMaterials(
  noteId: string,
  force = true,
): Promise<{
  noteId: string;
  stage: "pending";
  message: string;
}> {
  return apiFetch<{
    noteId: string;
    stage: "pending";
    message: string;
  }>(
    `/notes/${encodeURIComponent(noteId)}/generate`,
    {
      method: "POST",
      body: JSON.stringify({ force }),
    },
  );
}

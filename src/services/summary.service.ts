import { apiFetch } from "@/lib/api";
import type { SummaryResult } from "@/types/summary";

export function generateSummary(noteId: string, force = false): Promise<SummaryResult> {
  return apiFetch<SummaryResult>("/summary", {
    method: "POST",
    body: JSON.stringify({ noteId, force }),
  });
}
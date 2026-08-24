import { apiFetch } from "@/lib/api";
import type {
  SummaryMode,
  SummaryResult,
} from "@/types/summary";

export function generateSummary(
  noteId: string,
  force = false,
  mode: SummaryMode = "comprehensive",
): Promise<SummaryResult> {
  return apiFetch<SummaryResult>("/summary", {
    method: "POST",
    body: JSON.stringify({ noteId, force, mode }),
  });
}

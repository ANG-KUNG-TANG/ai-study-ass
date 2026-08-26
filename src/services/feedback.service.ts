import { apiFetch, apiFetchPaginated } from "@/lib/api";
import type { PaginationMeta } from "@/types/pagination";
import type {
  AdminFeedbackQuery,
  AdminFeedbackSubmission,
  CreateFeedbackInput,
  FeedbackSubmission,
  FeedbackStatus,
} from "@/types/feedback";

function queryString(
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function adminFeedbackQuery(params: AdminFeedbackQuery = {}): string {
  return queryString({
    page: params.page,
    limit: params.limit,
    search: params.search,
    type: params.type,
    status: params.status,
  });
}

export function listOwnFeedback(limit = 20): Promise<FeedbackSubmission[]> {
  return apiFetch(`/feedback?limit=${encodeURIComponent(String(limit))}`);
}

export function submitFeedback(
  input: CreateFeedbackInput,
): Promise<FeedbackSubmission> {
  return apiFetch("/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAdminFeedback(
  params: AdminFeedbackQuery = {},
): Promise<{ data: AdminFeedbackSubmission[]; meta: PaginationMeta }> {
  return apiFetchPaginated<AdminFeedbackSubmission>(
    `/admin/feedback${adminFeedbackQuery(params)}`,
  );
}

export function updateAdminFeedback(
  id: string,
  input: { status: FeedbackStatus; adminNote: string },
): Promise<AdminFeedbackSubmission> {
  return apiFetch(`/admin/feedback/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function exportAdminFeedback(
  params: AdminFeedbackQuery = {},
): Promise<void> {
  const result = await apiFetch<{ csv: string }>(
    `/admin/feedback/export${adminFeedbackQuery(params)}`,
  );
  const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `user-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

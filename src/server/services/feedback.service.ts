import {
  FeedbackEntity,
  type FeedbackStatus,
  type FeedbackType,
} from "@/server/entities/feedback.entity";
import * as feedbackRepo from "@/server/repositories/feedback.repo";
import { NotFoundError } from "@/server/utils/errors";
import { buildPaginationMeta } from "@/server/utils/response";

export async function createFeedback(
  userId: string,
  userEmail: string,
  input: {
    type: FeedbackType;
    title: string;
    message: string;
    rating?: number | null;
    sourcePath?: string;
  },
) {
  const entity = FeedbackEntity.create({
    userId,
    userEmail,
    ...input,
  });

  return (await feedbackRepo.create(entity)).toUserView();
}

export async function listUserFeedback(userId: string, limit: number) {
  const entries = await feedbackRepo.findRecentByUser(userId, limit);
  return entries.map((entry) => entry.toUserView());
}

export async function listAdminFeedback(query: {
  page?: number;
  limit?: number;
  search?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
}) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
  const result = await feedbackRepo.findPage({ ...query, page, limit });

  return {
    data: result.data.map((entry) => entry.toAdminView()),
    meta: buildPaginationMeta(result.total, page, limit),
  };
}

export async function reviewFeedback(
  id: string,
  adminId: string,
  input: { status: FeedbackStatus; adminNote: string },
) {
  const updated = await feedbackRepo.updateReview(id, {
    status: input.status,
    adminNote: input.adminNote.trim(),
    reviewedBy: adminId,
    reviewedAt: new Date(),
  });

  if (!updated) throw new NotFoundError("Feedback");
  return updated.toAdminView();
}

function safeCsvValue(value: unknown): string {
  let text = value === undefined || value === null
    ? ""
    : String(value);

  // Prevent spreadsheet applications from executing user-controlled formulas.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportFeedbackCsv(query: {
  search?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
}): Promise<string> {
  const entries = await feedbackRepo.findForExport(query);
  const header = [
    "id",
    "submittedAt",
    "updatedAt",
    "userEmail",
    "type",
    "title",
    "message",
    "rating",
    "sourcePath",
    "status",
    "adminNote",
    "reviewedBy",
    "reviewedAt",
  ];

  const rows = entries.map((entry) => [
    entry.id,
    entry.createdAt.toISOString(),
    entry.updatedAt.toISOString(),
    entry.userEmail,
    entry.type,
    entry.title,
    entry.message,
    entry.rating,
    entry.sourcePath,
    entry.status,
    entry.adminNote,
    entry.reviewedBy,
    entry.reviewedAt?.toISOString() ?? "",
  ].map(safeCsvValue).join(","));

  return [header.map(safeCsvValue).join(","), ...rows].join("\n");
}

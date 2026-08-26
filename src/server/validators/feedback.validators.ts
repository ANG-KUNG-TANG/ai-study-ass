import { z } from "zod";

import {
  FEEDBACK_RULES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
} from "@/server/entities/feedback.entity";

export const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z
    .string()
    .trim()
    .min(FEEDBACK_RULES.TITLE_MIN)
    .max(FEEDBACK_RULES.TITLE_MAX),
  message: z
    .string()
    .trim()
    .min(FEEDBACK_RULES.MESSAGE_MIN)
    .max(FEEDBACK_RULES.MESSAGE_MAX),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  sourcePath: z
    .string()
    .trim()
    .max(FEEDBACK_RULES.SOURCE_PATH_MAX)
    .optional(),
});

export const userFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  type: z.enum(FEEDBACK_TYPES).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional(),
});

export const reviewFeedbackSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  adminNote: z.string().trim().max(FEEDBACK_RULES.ADMIN_NOTE_MAX).default(""),
});

export async function parseCreateFeedback(req: Request) {
  const body: unknown = await req.json();
  return createFeedbackSchema.parse(body);
}

export async function parseReviewFeedback(req: Request) {
  const body: unknown = await req.json();
  return reviewFeedbackSchema.parse(body);
}

export function parseUserFeedbackQuery(req: Request) {
  const url = new URL(req.url);
  return userFeedbackQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
  });
}

export function parseAdminFeedbackQuery(req: Request) {
  const url = new URL(req.url);
  return adminFeedbackQuerySchema.parse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
}

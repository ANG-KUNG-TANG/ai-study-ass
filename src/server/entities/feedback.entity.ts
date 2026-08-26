import { randomUUID } from "node:crypto";

import { ValidationError } from "@/server/utils/errors";

export const FEEDBACK_TYPES = [
  "general",
  "suggestion",
  "feature_request",
  "bug",
] as const;

export const FEEDBACK_STATUSES = [
  "new",
  "reviewing",
  "planned",
  "implemented",
  "closed",
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_RULES = {
  TITLE_MIN: 5,
  TITLE_MAX: 120,
  MESSAGE_MIN: 10,
  MESSAGE_MAX: 5_000,
  SOURCE_PATH_MAX: 500,
  ADMIN_NOTE_MAX: 2_000,
} as const;

export interface FeedbackUserView {
  id: string;
  type: FeedbackType;
  title: string;
  message: string;
  rating: number | null;
  sourcePath: string;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackAdminView extends FeedbackUserView {
  userId: string;
  userEmail: string;
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}

export interface CreateFeedbackEntityInput {
  userId: string;
  userEmail: string;
  type: FeedbackType;
  title: string;
  message: string;
  rating?: number | null;
  sourcePath?: string;
}

function cleanBoundedText(
  value: string,
  field: "title" | "message",
  min: number,
  max: number,
): string {
  const cleaned = value.trim();

  if (cleaned.length < min || cleaned.length > max) {
    throw new ValidationError("Validation failed", {
      [field]: `${field === "title" ? "Title" : "Feedback"} must be between ${min} and ${max} characters`,
    });
  }

  return cleaned;
}

function cleanRating(value?: number | null): number | null {
  if (value === undefined || value === null) return null;

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new ValidationError("Validation failed", {
      rating: "Rating must be a whole number from 1 to 5",
    });
  }

  return value;
}

export class FeedbackEntity {
  private constructor(
    private readonly data: FeedbackAdminView,
  ) {}

  static create(input: CreateFeedbackEntityInput): FeedbackEntity {
    const now = new Date();
    const sourcePath = input.sourcePath?.trim() ?? "";

    if (sourcePath.length > FEEDBACK_RULES.SOURCE_PATH_MAX) {
      throw new ValidationError("Validation failed", {
        sourcePath: `Source path cannot exceed ${FEEDBACK_RULES.SOURCE_PATH_MAX} characters`,
      });
    }

    return new FeedbackEntity({
      id: randomUUID(),
      userId: input.userId,
      userEmail: input.userEmail.trim().toLowerCase(),
      type: input.type,
      title: cleanBoundedText(
        input.title,
        "title",
        FEEDBACK_RULES.TITLE_MIN,
        FEEDBACK_RULES.TITLE_MAX,
      ),
      message: cleanBoundedText(
        input.message,
        "message",
        FEEDBACK_RULES.MESSAGE_MIN,
        FEEDBACK_RULES.MESSAGE_MAX,
      ),
      rating: cleanRating(input.rating),
      sourcePath,
      status: "new",
      adminNote: "",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(data: FeedbackAdminView): FeedbackEntity {
    return new FeedbackEntity({
      ...data,
      rating: data.rating ?? null,
      sourcePath: data.sourcePath ?? "",
      adminNote: data.adminNote ?? "",
      reviewedBy: data.reviewedBy ?? null,
      reviewedAt: data.reviewedAt ?? null,
    });
  }

  get id(): string {
    return this.data.id;
  }

  get userId(): string {
    return this.data.userId;
  }

  toUserView(): FeedbackUserView {
    const {
      userId: _userId,
      userEmail: _userEmail,
      adminNote: _adminNote,
      reviewedBy: _reviewedBy,
      reviewedAt: _reviewedAt,
      ...userView
    } = this.data;

    return userView;
  }

  toAdminView(): FeedbackAdminView {
    return { ...this.data };
  }
}

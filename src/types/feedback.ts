export type FeedbackType =
  | "general"
  | "suggestion"
  | "feature_request"
  | "bug";

export type FeedbackStatus =
  | "new"
  | "reviewing"
  | "planned"
  | "implemented"
  | "closed";

export interface FeedbackSubmission {
  id: string;
  type: FeedbackType;
  title: string;
  message: string;
  rating: number | null;
  sourcePath: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeedbackSubmission extends FeedbackSubmission {
  userId: string;
  userEmail: string;
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface CreateFeedbackInput {
  type: FeedbackType;
  title: string;
  message: string;
  rating?: number | null;
  sourcePath?: string;
}

export interface AdminFeedbackQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
}

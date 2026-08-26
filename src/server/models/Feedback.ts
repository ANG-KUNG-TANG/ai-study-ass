import mongoose, { Schema, type Document, type Model } from "mongoose";

import {
  FEEDBACK_RULES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackStatus,
  type FeedbackType,
} from "@/server/entities/feedback.entity";

export interface IFeedback extends Document<string> {
  _id: string;
  userId: string;
  userEmail: string;
  type: FeedbackType;
  title: string;
  message: string;
  rating: number | null;
  sourcePath: string;
  status: FeedbackStatus;
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    type: { type: String, enum: FEEDBACK_TYPES, required: true, index: true },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: FEEDBACK_RULES.TITLE_MIN,
      maxlength: FEEDBACK_RULES.TITLE_MAX,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: FEEDBACK_RULES.MESSAGE_MIN,
      maxlength: FEEDBACK_RULES.MESSAGE_MAX,
    },
    rating: { type: Number, min: 1, max: 5, default: null },
    sourcePath: {
      type: String,
      trim: true,
      maxlength: FEEDBACK_RULES.SOURCE_PATH_MAX,
      default: "",
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: "new",
      required: true,
      index: true,
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: FEEDBACK_RULES.ADMIN_NOTE_MAX,
      default: "",
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, type: 1, createdAt: -1 });

export const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ??
  mongoose.model<IFeedback>("Feedback", feedbackSchema);

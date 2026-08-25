import mongoose from "mongoose";
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

import {
  AI_USAGE_PROVIDERS,
  type AIUsageProvider,
} from "@/server/entities/ai-usage.entity";

export interface AIUsagePersistence {
  _id: string;

  userId: string | null;
  noteId: string | null;

  provider: AIUsageProvider;
  model: string;
  usageLabel: string;

  success: boolean;

  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;

  statusCode: number | null;
  quotaExceeded: boolean;

  createdAt: Date;
}

export type AIUsageDocument =
  HydratedDocument<AIUsagePersistence>;

const aiUsageSchema =
  new Schema<AIUsagePersistence>(
    {
      _id: {
        type: String,
        required: true,
      },

      userId: {
        type: String,
        default: null,
        index: true,
      },

      noteId: {
        type: String,
        default: null,
        index: true,
      },

      provider: {
        type: String,
        enum: AI_USAGE_PROVIDERS,
        required: true,
        index: true,
      },

      model: {
        type: String,
        required: true,
        trim: true,
      },

      usageLabel: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      success: {
        type: Boolean,
        required: true,
      },

      tokensUsed: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      inputTokens: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      outputTokens: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      estimatedCostUsd: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      latencyMs: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      statusCode: {
        type: Number,
        default: null,
      },

      quotaExceeded: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
    {
      timestamps: {
        createdAt: true,
        updatedAt: false,
      },
      versionKey: false,
    },
  );

aiUsageSchema.index({
  userId: 1,
  createdAt: -1,
});

aiUsageSchema.index({
  provider: 1,
  createdAt: -1,
});

aiUsageSchema.index({
  usageLabel: 1,
  createdAt: -1,
});

aiUsageSchema.index({
  noteId: 1,
  createdAt: -1,
});

export const AIUsage:
  Model<AIUsagePersistence> =
  (mongoose.models.AIUsage as
    | Model<AIUsagePersistence>
    | undefined) ??
  model<AIUsagePersistence>(
    "AIUsage",
    aiUsageSchema,
  );

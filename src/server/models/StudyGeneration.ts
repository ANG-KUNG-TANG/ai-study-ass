import mongoose, { type Model, Schema } from "mongoose";
import type {
  FeatureGenerationState,
  GenerationFeature,
  StudyGenerationStage,
} from "@/server/types/generation";

export interface IStudyGeneration {
  _id: string;
  noteId: string;
  userId: string;
  stage: StudyGenerationStage;
  features: Record<GenerationFeature, FeatureGenerationState>;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const featureStateSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "generating", "ready", "partial", "failed"],
      required: true,
      default: "pending",
    },
    source: {
      type: String,
      enum: ["symbolic", "hybrid", "ai_fallback"],
      default: null,
    },
    confidence: { type: Number, min: 0, max: 1, default: null },
    aiFallbackUsed: { type: Boolean, required: true, default: false },
    itemCount: { type: Number, min: 0, default: null },
    error: { type: String, default: null },
    updatedAt: { type: Date, required: true, default: Date.now },

    currentStep: {
      type: String,
      enum: [
        "queued",
        "intelligence",
        "summary",
        "quiz",
        "flashcards",
        "chatKnowledge",
        "complete",
      ],
      default: "queued",
    },
  },

  { _id: false },
);

function defaultFeatureState(): FeatureGenerationState {
  return {
    status: "pending",
    source: null,
    confidence: null,
    aiFallbackUsed: false,
    itemCount: null,
    error: null,
    updatedAt: new Date(),
  };
}

const studyGenerationSchema = new Schema(
  {
    _id: { type: String, required: true },
    noteId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    stage: {
      type: String,
      enum: [
        "extracting",
        "vision_ocr",
        "pending",
        "analyzing",
        "generating",
        "complete",
        "partial",
        "failed",
      ],
      required: true,
      default: "pending",
    },
    features: {
      summary: { type: featureStateSchema, default: defaultFeatureState },
      quiz: { type: featureStateSchema, default: defaultFeatureState },
      flashcards: { type: featureStateSchema, default: defaultFeatureState },
      chatKnowledge: { type: featureStateSchema, default: defaultFeatureState },
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studyGenerationSchema.index({ userId: 1, updatedAt: -1 });

export const StudyGeneration: Model<IStudyGeneration> =
  (mongoose.models.StudyGeneration as Model<IStudyGeneration> | undefined) ??
  mongoose.model<IStudyGeneration>("StudyGeneration", studyGenerationSchema);

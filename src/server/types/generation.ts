export const GENERATION_SOURCES = [
  "symbolic",
  "hybrid",
  "ai_fallback",
] as const;

export type GenerationSource = (typeof GENERATION_SOURCES)[number];

export const GENERATION_FEATURES = [
  "summary",
  "quiz",
  "flashcards",
  "chatKnowledge",
] as const;

export type GenerationFeature = (typeof GENERATION_FEATURES)[number];

export type FeatureGenerationStatus =
  | "pending"
  | "generating"
  | "ready"
  | "partial"
  | "failed";

export type StudyGenerationStage =
  | "pending"
  | "analyzing"
  | "generating"
  | "complete"
  | "partial"
  | "failed";

export interface GenerationMetadata {
  source: GenerationSource;
  confidence: number;
  aiFallbackUsed: boolean;
  status: "ready" | "partial";
  itemCount?: number;
  tokensUsed?: number;
}

export interface FeatureGenerationState {
  status: FeatureGenerationStatus;
  source: GenerationSource | null;
  confidence: number | null;
  aiFallbackUsed: boolean;
  itemCount: number | null;
  error: string | null;
  updatedAt: Date;
}

export interface StudyGenerationState {
  noteId: string;
  userId: string;
  stage: StudyGenerationStage;
  features: Record<GenerationFeature, FeatureGenerationState>;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

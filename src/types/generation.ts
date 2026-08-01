export type GenerationSource =
  | "symbolic"
  | "hybrid"
  | "ai_fallback";

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

export interface FeatureGenerationState {
  status: FeatureGenerationStatus;
  source: GenerationSource | null;
  confidence: number | null;
  aiFallbackUsed: boolean;
  itemCount: number | null;
  error: string | null;
  updatedAt: string;
}

export interface StudyGenerationState {
  noteId: string;
  userId: string;
  stage: StudyGenerationStage;
  features: {
    summary: FeatureGenerationState;
    quiz: FeatureGenerationState;
    flashcards: FeatureGenerationState;
    chatKnowledge: FeatureGenerationState;
  };
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

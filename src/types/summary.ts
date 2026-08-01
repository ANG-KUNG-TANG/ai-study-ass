import type { GenerationSource } from "@/types/generation";

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  cached: boolean;
  source: GenerationSource;
  confidence: number;
  aiFallbackUsed: boolean;
  status: "ready" | "partial";
  itemCount?: number;
  tokensUsed: number;
}

import type { GenerationSource } from "@/types/generation";

export const SUMMARY_MODES = [
  "concise",
  "comprehensive",
  "exam",
] as const;

export type SummaryMode = (typeof SUMMARY_MODES)[number];

export interface SummaryResult {
  summary: string;
  mode: SummaryMode;
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

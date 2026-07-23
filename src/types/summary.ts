export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  cached: boolean;
  tokensUsed: number;
}
// server/types/ai.types.ts

export type AIProvider = 'openai' | 'gemini';

export interface AIGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerateResult {
  text: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
  latencyMs: number;
}
import { env } from "@/server/config/env";

export type AIProvider = "openai" | "gemini";

export interface AIConfig {
  readonly activeProvider: AIProvider;
  readonly openai: {
    readonly apiKey: string;
    readonly model: string;
  };
  readonly gemini: {
    readonly apiKey: string;
    readonly model: string;
  };
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
}

// Provider keys are intentionally optional. Feature services attempt symbolic
// generation first and catch provider failures when AI fallback is unavailable.
export const AI_CONFIG: AIConfig = {
  activeProvider: env.AI_PROVIDER,
  openai: {
    apiKey: env.OPENAI_API_KEY?.trim() ?? "",
    model: env.OPENAI_MODEL.trim(),
  },
  gemini: {
    apiKey: env.GEMINI_API_KEY?.trim() ?? "",
    model: env.GEMINI_MODEL.trim().replace(/^models\//, ""),
  },
  requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
  maxRetries: env.AI_MAX_RETRIES,
};

export function isAIProviderConfigured(provider: AIProvider): boolean {
  return provider === "openai"
    ? AI_CONFIG.openai.apiKey.length > 0
    : AI_CONFIG.gemini.apiKey.length > 0;
}

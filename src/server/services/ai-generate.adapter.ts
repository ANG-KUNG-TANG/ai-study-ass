import { generateForIntelligence } from "@/server/services/ai.service";
import type { AIGenerateFn } from "@/server/intelligence/types";

/** Compatibility adapter for older callers. */
export const aiGenerate: AIGenerateFn = async (prompt) => {
  const result = await generateForIntelligence(prompt);
  return {
    text: result.text,
    tokensUsed: result.tokensUsed,
    provider: result.provider,
  };
};

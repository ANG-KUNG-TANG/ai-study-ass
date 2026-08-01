import * as aiService from "@/server/services/ai.service";
import type { AIGenerateFn } from "@/server/intelligence/types";

/**
 * This adapter keeps the note generator independent from your provider.
 * It supports common function names and common OpenAI/Gemini response shapes.
 *
 * If your ai.service.ts uses a different exported function name, add it to
 * FUNCTION_NAMES below. No other file needs to change.
 */
const FUNCTION_NAMES = [
  "generateText",
  "generateAIResponse",
  "generateResponse",
  "generateContent",
  "generate",
  "complete",
  "askAI",
] as const;

type UnknownRecord = Record<string, unknown>;
type UnknownGenerateFunction = (prompt: string) => Promise<unknown> | unknown;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

async function extractText(raw: unknown): Promise<string | null> {
  if (typeof raw === "string") return raw.trim() || null;

  const record = asRecord(raw);
  if (!record) return null;

  for (const key of ["text", "content", "outputText", "output", "result"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  // OpenAI-style response: choices[0].message.content
  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = asRecord(choices[0]);
    const message = asRecord(firstChoice?.message);
    const content = message?.content;
    if (typeof content === "string" && content.trim()) return content.trim();
  }

  // Gemini-style response: candidates[0].content.parts[0].text
  const candidates = record.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const firstCandidate = asRecord(candidates[0]);
    const content = asRecord(firstCandidate?.content);
    const parts = content?.parts;

    if (Array.isArray(parts)) {
      const joined = parts
        .map((part) => asRecord(part)?.text)
        .filter((part): part is string => typeof part === "string")
        .join("\n")
        .trim();

      if (joined) return joined;
    }
  }

  // Some Gemini wrappers return { response: { text: () => string } }.
  const response = asRecord(record.response);
  if (response && typeof response.text === "function") {
    const value = await (response.text as () => Promise<unknown> | unknown)();
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function extractTokens(raw: unknown): number | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  const direct = record.tokensUsed;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;

  const usage = asRecord(record.usage);
  if (usage) {
    for (const key of ["totalTokens", "total_tokens", "tokens"] as const) {
      const value = usage[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }

  return undefined;
}

function extractProvider(raw: unknown): "openai" | "gemini" | undefined {
  const provider = asRecord(raw)?.provider;
  return provider === "openai" || provider === "gemini" ? provider : undefined;
}

function resolveGenerateFunction(): UnknownGenerateFunction {
  const moduleRecord = aiService as unknown as UnknownRecord;

  for (const name of FUNCTION_NAMES) {
    const candidate = moduleRecord[name];
    if (typeof candidate === "function") {
      return candidate as UnknownGenerateFunction;
    }
  }

  throw new Error(
    `No compatible AI generation function was found in server/services/ai.service.ts. ` +
      `Export one of: ${FUNCTION_NAMES.join(", ")}. Existing exports: ${Object.keys(moduleRecord).join(", ")}`,
  );
}

export const aiGenerate: AIGenerateFn = async (prompt) => {
  const generate = resolveGenerateFunction();
  const raw = await generate(prompt);
  const text = await extractText(raw);

  if (!text) {
    throw new Error("The AI service returned no usable text");
  }

  return {
    text,
    tokensUsed: extractTokens(raw),
    provider: extractProvider(raw),
  };
};

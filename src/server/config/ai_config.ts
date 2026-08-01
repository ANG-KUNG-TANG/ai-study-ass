// src/server/config/ai_config.ts

import { z } from "zod";

export const AI_PROVIDERS = [
  "openai",
  "gemini",
] as const;

export type AIProvider =
  (typeof AI_PROVIDERS)[number];

const aiEnvSchema = z
  .object({
    AI_PROVIDER: z
      .enum(AI_PROVIDERS)
      .default("gemini"),

    OPENAI_API_KEY: z
      .string()
      .trim()
      .min(1)
      .optional(),

    OPENAI_MODEL: z
      .string()
      .trim()
      .min(1)
      .default("gpt-4o-mini"),

    GEMINI_API_KEY: z
      .string()
      .trim()
      .min(1)
      .optional(),

    GEMINI_MODEL: z
      .string()
      .trim()
      .min(1)
      .default("gemini-3.6-flash"),

    AI_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000),

    AI_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(5)
      .default(2),
  })
  .superRefine((env, context) => {
    if (
      env.AI_PROVIDER === "openai" &&
      !env.OPENAI_API_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message:
          "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }

    if (
      env.AI_PROVIDER === "gemini" &&
      !env.GEMINI_API_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["GEMINI_API_KEY"],
        message:
          "GEMINI_API_KEY is required when AI_PROVIDER=gemini",
      });
    }
  });

const result = aiEnvSchema.safeParse(
  process.env,
);

if (!result.success) {
  console.error(
    "Invalid AI environment configuration:",
    result.error.flatten().fieldErrors,
  );

  throw new Error(
    "AI configuration validation failed.",
  );
}

const env = result.data;

function normalizeGeminiModel(
  model: string,
): string {
  return model
    .trim()
    .replace(/^models\//, "");
}

export const AI_CONFIG = {
  activeProvider:
    env.AI_PROVIDER as AIProvider,

  openai: {
    apiKey: env.OPENAI_API_KEY ?? "",
    model: env.OPENAI_MODEL,
  },

  gemini: {
    apiKey: env.GEMINI_API_KEY ?? "",
    model: normalizeGeminiModel(
      env.GEMINI_MODEL,
    ),
  },

  maxRetries: env.AI_MAX_RETRIES,

  requestTimeoutMs:
    env.AI_REQUEST_TIMEOUT_MS,
} as const;
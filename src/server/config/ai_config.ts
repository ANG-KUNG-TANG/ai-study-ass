// =============================================================================
// server/config/ai.ts
//
// AI provider configuration. Validated once at import time with Zod, same
// fail-fast pattern as env.ts — if required keys for the active provider are
// missing, the process crashes at startup instead of failing on the first
// request. Consumed by services/ai.service.ts only; no other module should
// read process.env for AI settings directly.
//
// ASSUMPTION TO VERIFY: this assumes your existing env.ts does NOT already
// declare these AI_* keys on its own schema. If it does, delete this file's
// z.object() call and instead re-export the relevant slice of your existing
// typed env object — you want exactly one place validating each env var,
// per your "single source of truth for constants" principle.
// =============================================================================

import { z } from 'zod';

const aiEnvSchema = z.object({
  AI_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),

  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
});

const parsed = aiEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast — same contract as env.ts: crash at startup, never at request time.
  // eslint-disable-next-line no-console
  console.error('Invalid AI environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('AI config validation failed — see printed errors above.');
}

const env = parsed.data;

// Cross-field check Zod's schema-level validation can't express on its own:
// the API key for whichever provider is ACTIVE must be present. The other
// provider's key is allowed to be absent — you only need one configured.
if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
  throw new Error("AI_PROVIDER is 'openai' but OPENAI_API_KEY is not set.");
}
if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
  throw new Error("AI_PROVIDER is 'gemini' but GEMINI_API_KEY is not set.");
}

export type AIProvider = 'openai' | 'gemini';

export interface AIConfig {
  readonly activeProvider: AIProvider;
  readonly openai: { readonly apiKey: string; readonly model: string };
  readonly gemini: { readonly apiKey: string; readonly model: string };
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
}

export const AI_CONFIG: AIConfig = {
  activeProvider: env.AI_PROVIDER,
  openai: { apiKey: env.OPENAI_API_KEY ?? '', model: env.OPENAI_MODEL },
  gemini: { apiKey: env.GEMINI_API_KEY ?? '', model: env.GEMINI_MODEL },
  requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
  maxRetries: env.AI_MAX_RETRIES,
};
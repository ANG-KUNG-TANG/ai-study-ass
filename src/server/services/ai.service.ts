// =============================================================================
// server/services/ai.service.ts
//
// Central AI module — the ONLY place in the codebase that talks to OpenAI or
// Gemini directly. summary.service.ts, quiz.service.ts, flashcard.service.ts,
// and chat.service.ts all call generate() here; none of them should import
// 'openai' or call fetch() against an AI endpoint themselves. That keeps the
// provider swap (or a future symbolic-engine reintroduction) a one-file change.
//
// ASSUMPTION TO VERIFY: AIError is defined locally below as a minimal 502
// error. Your Week 1 foundation already has an AIError class in the shared
// error-classes module — if so, delete the local class here and import that
// one instead, so there's a single AIError definition, not two.
// =============================================================================

import { AI_CONFIG, type AIProvider } from '@/server/config/ai_config';
import { AIError } from '@/server/utils/errors'; // ADJUST PATH if different

// ─── Public contract ──────────────────────────────────────────────────────────

export interface AIGenerateOptions {
  /** Full prompt text — prompt builders (summary/quiz/chat) assemble this. */
  prompt: string;
  /** Optional system instruction, kept separate from the user prompt. */
  systemPrompt?: string;
  /** Caps response length. Provider-specific default applies if omitted. */
  maxTokens?: number;
  /** 0–1, lower = more deterministic. Provider-specific default if omitted. */
  temperature?: number;
  /**
   * When true, instructs the provider to return ONLY valid JSON with no
   * prose/markdown fences — quiz.service.ts and flashcard.service.ts need
   * this for structured output parsing.
   */
  jsonMode?: boolean;
}

export interface AIGenerateResult {
  text: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

// ─── Retry / timeout policy ───────────────────────────────────────────────────
// Retries only on retryable conditions: HTTP 429 (rate limit) and 5xx
// (transient provider-side failure). 4xx errors other than 429 (bad request,
// auth failure) are NOT retried — retrying a malformed request 3 times just
// delays the inevitable AIError by ~triple the timeout for no benefit.

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const BASE_BACKOFF_MS = 500;

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

function backoffDelay(attempt: number): number {
  // 500ms, 1000ms, 2000ms — exponential, no jitter needed at this scale.
  return BASE_BACKOFF_MS * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Provider adapters ────────────────────────────────────────────────────────
// Each adapter takes the same AIGenerateOptions and returns the same
// AIGenerateResult shape — generate() below doesn't need to know which
// provider it called. Each adapter throws a plain Error with a `.status`
// property (HTTP status code) on failure so the retry loop can inspect it;
// generate() converts that into the final AIError after retries are exhausted.

interface AdapterError extends Error {
  status?: number;
}

async function callOpenAI(
  options: AIGenerateOptions,
  signal: AbortSignal,
): Promise<AIGenerateResult> {
  const { apiKey, model } = AI_CONFIG.openai;

  const messages = [
    ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
    { role: 'user', content: options.prompt },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const err: AdapterError = new Error(`OpenAI returned ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const tokensUsed: number = data?.usage?.total_tokens ?? 0;

  return { text, tokensUsed, provider: 'openai', model };
}

async function callGemini(
  options: AIGenerateOptions,
  signal: AbortSignal,
): Promise<AIGenerateResult> {
  const { apiKey, model } = AI_CONFIG.gemini;

  const fullPrompt = options.systemPrompt
    ? `${options.systemPrompt}\n\n${options.prompt}`
    : options.prompt;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
        ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!response.ok) {
    const err: AdapterError = new Error(`Gemini returned ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokensUsed: number =
    (data?.usageMetadata?.promptTokenCount ?? 0) +
    (data?.usageMetadata?.candidatesTokenCount ?? 0);

  return { text, tokensUsed, provider: 'gemini', model };
}

const ADAPTERS: Record<AIProvider, typeof callOpenAI> = {
  openai: callOpenAI,
  gemini: callGemini,
};

// ─── Public entry point ────────────────────────────────────────────────────────

/**
 * Generate text from the active AI provider (config/ai.ts's AI_PROVIDER).
 * Retries up to AI_CONFIG.maxRetries times on 429/5xx, with exponential
 * backoff. Every attempt is bounded by AI_CONFIG.requestTimeoutMs via
 * AbortController — a hung request can't stall a request indefinitely.
 * Throws AIError if every attempt fails or a non-retryable error occurs.
 */
export async function generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const provider = AI_CONFIG.activeProvider;
  const adapter = ADAPTERS[provider];
  const maxAttempts = AI_CONFIG.maxRetries + 1; // maxRetries=3 → up to 4 total attempts

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_CONFIG.requestTimeoutMs);

    try {
      const result = await adapter(options, controller.signal);
      clearTimeout(timeout);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      const status = (err as AdapterError)?.status;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const retryable = isAbort || (typeof status === 'number' && isRetryableStatus(status));

      const isLastAttempt = attempt === maxAttempts - 1;
      if (!retryable || isLastAttempt) {
        throw new AIError(
          isAbort ? `timed out after ${AI_CONFIG.requestTimeoutMs}ms` : String(err),
        );
      }

      await sleep(backoffDelay(attempt));
    }
  }

  // Unreachable given the loop above always returns or throws, but keeps
  // TypeScript's control-flow analysis happy without a non-null assertion.
  throw new AIError('exhausted retries');
}
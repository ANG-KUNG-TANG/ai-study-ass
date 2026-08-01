// =============================================================================
// src/server/services/ai.service.ts
//
// Central AI module. Only server-side feature services should import this file.
// The browser must never call Gemini/OpenAI directly or receive an API key.
// =============================================================================

import { AI_CONFIG, type AIProvider } from "@/server/config/ai_config";
import { AIError } from "@/server/utils/errors";

// ─── Public contract ──────────────────────────────────────────────────────────

export interface AIGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface AIGenerateResult {
  text: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}

export interface IntelligenceAIResult {
  text: string;
  tokensUsed?: number;
  provider?: AIProvider;
}

// ─── Retry / timeout policy ───────────────────────────────────────────────────

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const BASE_BACKOFF_MS = 1_500;
const MAX_RETRY_DELAY_MS = 60_000;
const RETRY_JITTER_MS = 350;

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

function exponentialBackoffMs(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addJitter(ms: number): number {
  return ms + Math.floor(Math.random() * RETRY_JITTER_MS);
}

// ─── Provider errors ──────────────────────────────────────────────────────────

interface AdapterError extends Error {
  status?: number;
  retryAfterMs?: number;
  retryable?: boolean;
  publicMessage?: string;
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const retryDate = Date.parse(value);
  if (!Number.isNaN(retryDate)) {
    return Math.max(0, retryDate - Date.now());
  }

  return undefined;
}

interface GeminiQuotaInfo {
  retryAfterMs?: number;
  dailyQuotaExceeded: boolean;
  quotaId?: string;
}

function parseGeminiQuotaInfo(responseText: string): GeminiQuotaInfo {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: {
        details?: Array<{
          "@type"?: string;
          retryDelay?: string;
          violations?: Array<{
            quotaId?: string;
            quotaMetric?: string;
          }>;
        }>;
      };
    };

    const details = parsed.error?.details ?? [];

    const retryInfo = details.find(
      (detail) =>
        detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
    );

    let retryAfterMs: number | undefined;
    const retryDelay = retryInfo?.retryDelay;

    if (retryDelay?.endsWith("s")) {
      const seconds = Number.parseFloat(retryDelay.slice(0, -1));

      if (Number.isFinite(seconds) && seconds >= 0) {
        retryAfterMs = Math.ceil(seconds * 1_000);
      }
    }

    const quotaIds = details.flatMap(
      (detail) =>
        detail.violations
          ?.map((violation) => violation.quotaId ?? "")
          .filter(Boolean) ?? [],
    );

    const dailyQuotaId = quotaIds.find((quotaId) =>
      /PerDay|RequestsPerDay/i.test(quotaId),
    );

    return {
      retryAfterMs,
      dailyQuotaExceeded: Boolean(dailyQuotaId),
      quotaId: dailyQuotaId,
    };
  } catch {
    return {
      dailyQuotaExceeded: false,
    };
  }
}

function publicProviderError(
  provider: "Gemini" | "OpenAI",
  status: number,
): string {
  switch (status) {
    case 400:
      return `${provider} rejected the generation request.`;
    case 401:
    case 403:
      return `${provider} authentication failed. Check the server API key.`;
    case 404:
      return `${provider} model is unavailable. Check the configured model.`;
    case 429:
      return "The AI request limit has been reached. Please wait and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The AI provider is temporarily unavailable. Please try again.";
    default:
      return "The AI request could not be completed.";
  }
}

function logProviderFailure(
  provider: AIProvider,
  model: string,
  status: number,
  details: string,
): void {
  // Never log an API key. This only logs provider, model, status and response.
  // eslint-disable-next-line no-console
  console.error("[AI provider error]", {
    provider,
    model,
    status,
    details: details.slice(0, 2_000),
  });
}

// ─── OpenAI adapter ───────────────────────────────────────────────────────────

async function callOpenAI(
  options: AIGenerateOptions,
  signal: AbortSignal,
): Promise<AIGenerateResult> {
  const { apiKey, model } = AI_CONFIG.openai;

  if (!apiKey.trim()) {
    throw new AIError("OPENAI_API_KEY is not configured.");
  }

  const messages = [
    ...(options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }]
      : []),
    { role: "user", content: options.prompt },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens ?? 1_024,
      temperature: options.temperature ?? 0.7,
      ...(options.jsonMode
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    logProviderFailure("openai", model, response.status, details);

    const error: AdapterError = new Error(
      `OpenAI returned ${response.status}`,
    );
    error.status = response.status;
    error.retryAfterMs = parseRetryAfterHeader(
      response.headers.get("retry-after"),
    );
    error.publicMessage = publicProviderError("OpenAI", response.status);
    throw error;
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const tokensUsed: number = data?.usage?.total_tokens ?? 0;

  if (!text.trim()) {
    const error: AdapterError = new Error("OpenAI returned an empty response");
    error.status = 502;
    error.publicMessage = "The AI provider returned an empty response.";
    throw error;
  }

  return {
    text: text.trim(),
    tokensUsed,
    provider: "openai",
    model,
  };
}

// ─── Gemini adapter ───────────────────────────────────────────────────────────

async function callGemini(
  options: AIGenerateOptions,
  signal: AbortSignal,
): Promise<AIGenerateResult> {
  const apiKey = AI_CONFIG.gemini.apiKey.trim();
  const model = AI_CONFIG.gemini.model
    .trim()
    .replace(/^models\//, "");

  if (!apiKey) {
    throw new AIError("GEMINI_API_KEY is not configured.");
  }

  if (!model) {
    throw new AIError("GEMINI_MODEL is not configured.");
  }

  // Keep the key out of the URL so it is less likely to appear in access logs.
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      ...(options.systemPrompt
        ? {
            systemInstruction: {
              parts: [{ text: options.systemPrompt }],
            },
          }
        : {}),
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1_024,
        temperature: options.temperature ?? 0.7,
        ...(options.jsonMode
          ? { responseMimeType: "application/json" }
          : {}),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    logProviderFailure("gemini", model, response.status, details);

    const headerDelay = parseRetryAfterHeader(
      response.headers.get("retry-after"),
    );

    const quotaInfo =
      response.status === 429
        ? parseGeminiQuotaInfo(details)
        : {
            dailyQuotaExceeded: false,
            retryAfterMs: undefined,
            quotaId: undefined,
          };

    const error: AdapterError = new Error(
      `Gemini returned ${response.status}`,
    );

    error.status = response.status;

    if (quotaInfo.dailyQuotaExceeded) {
      // A per-day quota cannot be solved by retrying seconds later. Returning
      // immediately prevents one student action from consuming more requests.
      error.retryable = false;
      error.publicMessage =
        "The daily AI generation limit has been reached. " +
        "Please use the saved study materials or try again after the quota resets.";
    } else {
      error.retryable =
        typeof response.status === "number" &&
        isRetryableStatus(response.status);

      error.retryAfterMs =
        headerDelay ?? quotaInfo.retryAfterMs;

      error.publicMessage =
        publicProviderError("Gemini", response.status);
    }

    throw error;
  }

  const data = await response.json();

  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("") ?? "";

  const tokensUsed: number =
    (data?.usageMetadata?.promptTokenCount ?? 0) +
    (data?.usageMetadata?.candidatesTokenCount ?? 0);

  if (!text.trim()) {
    const blockReason =
      data?.promptFeedback?.blockReason ??
      data?.candidates?.[0]?.finishReason ??
      "unknown reason";

    const error: AdapterError = new Error(
      `Gemini returned an empty response (${blockReason})`,
    );
    error.status = 502;
    error.publicMessage = "The AI provider returned an empty response.";
    throw error;
  }

  return {
    text: text.trim(),
    tokensUsed,
    provider: "gemini",
    model,
  };
}

// ─── Public entry points ──────────────────────────────────────────────────────

const ADAPTERS: Record<
  AIProvider,
  (
    options: AIGenerateOptions,
    signal: AbortSignal,
  ) => Promise<AIGenerateResult>
> = {
  openai: callOpenAI,
  gemini: callGemini,
};

export async function generate(
  options: AIGenerateOptions,
): Promise<AIGenerateResult> {
  const provider = AI_CONFIG.activeProvider;
  const adapter = ADAPTERS[provider];
  const maxAttempts = AI_CONFIG.maxRetries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AI_CONFIG.requestTimeoutMs,
    );

    try {
      return await adapter(options, controller.signal);
    } catch (unknownError) {
      const error = unknownError as AdapterError;
      const isAbort =
        unknownError instanceof Error &&
        unknownError.name === "AbortError";

      const retryable =
        isAbort ||
        (error.retryable !== false &&
          typeof error.status === "number" &&
          isRetryableStatus(error.status));

      const isLastAttempt = attempt === maxAttempts - 1;

      if (!retryable || isLastAttempt) {
        if (isAbort) {
          throw new AIError(
            `AI request timed out after ${AI_CONFIG.requestTimeoutMs}ms`,
          );
        }

        throw new AIError(
          error.publicMessage ??
            (unknownError instanceof Error
              ? unknownError.message
              : "The AI request could not be completed."),
        );
      }

      const delayMs = Math.min(
        error.retryAfterMs ?? exponentialBackoffMs(attempt),
        MAX_RETRY_DELAY_MS,
      );

      await sleep(addJitter(delayMs));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new AIError("AI generation exhausted all retry attempts.");
}

export async function generateForIntelligence(
  prompt: string,
): Promise<IntelligenceAIResult> {
  const result = await generate({
    prompt,
    systemPrompt:
      "Follow the requested output format exactly. " +
      "Return only the requested data and do not add markdown fences.",
    maxTokens: 1_400,
    temperature: 0.1,
  });

  return {
    text: result.text,
    tokensUsed: result.tokensUsed,
    provider: result.provider,
  };
}

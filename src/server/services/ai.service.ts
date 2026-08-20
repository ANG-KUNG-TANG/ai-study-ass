// =============================================================================
// src/server/services/ai.service.ts
//
// Central server-side AI gateway. Feature services call this module; browser
// code must never receive provider API keys or call providers directly.
// =============================================================================

import { AI_CONFIG, type AIProvider } from "@/server/config/ai_config";
import { AIError } from "@/server/utils/errors";
import { recordAIUsage } from "@/server/services/ai-usage.service";

// ─── Public contract ──────────────────────────────────────────────────────────

export interface AIGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;

  /** Logical feature label shown in AI usage dashboards. */
  usageLabel?: string;

  /**
   * Optional ownership context.
   * Internal/system AI calls may leave these undefined.
   */
  userId?: string;
  noteId?: string;
}

export interface AIGenerateResult {
  text: string;
  tokensUsed: number;
  provider: AIProvider;
  model: string;
}


// ─── Retry / timeout policy ──────────────────────────────────────────────────

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

// ─── Provider errors ─────────────────────────────────────────────────────────

interface AdapterError extends Error {
  status?: number;
  retryAfterMs?: number;
  retryable?: boolean;
  publicMessage?: string;
  quotaExceeded?: boolean;
}

function asAdapterError(error: unknown): AdapterError {
  if (error instanceof Error) {
    return error as AdapterError;
  }

  return new Error(String(error)) as AdapterError;
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
    return { dailyQuotaExceeded: false };
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
  // Provider diagnostics only; API keys are never included.
  console.error("[AI provider error]", {
    provider,
    model,
    status,
    details: details.slice(0, 2_000),
  });
}

function configuredModel(provider: AIProvider): string {
  return provider === "openai"
    ? AI_CONFIG.openai.model
    : AI_CONFIG.gemini.model.replace(/^models\//, "");
}

// ─── OpenAI adapter ──────────────────────────────────────────────────────────

async function callOpenAI(
  options: AIGenerateOptions,
  signal: AbortSignal,
): Promise<AIGenerateResult> {
  const { apiKey, model } = AI_CONFIG.openai;

  if (!apiKey.trim()) {
    throw new AIError("OPENAI_API_KEY is not configured.", "openai");
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
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    logProviderFailure("openai", model, response.status, details);

    const error: AdapterError = new Error(`OpenAI returned ${response.status}`);
    error.status = response.status;
    error.retryable = isRetryableStatus(response.status);
    error.retryAfterMs = parseRetryAfterHeader(
      response.headers.get("retry-after"),
    );
    error.publicMessage = publicProviderError("OpenAI", response.status);
    throw error;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed = data.usage?.total_tokens ?? 0;

  if (!text.trim()) {
    const error: AdapterError = new Error("OpenAI returned an empty response");
    error.status = 502;
    error.retryable = true;
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

// ─── Gemini adapter ──────────────────────────────────────────────────────────

async function callGemini(
  options: AIGenerateOptions,
  signal: AbortSignal,
): Promise<AIGenerateResult> {
  const apiKey = AI_CONFIG.gemini.apiKey.trim();
  const model = AI_CONFIG.gemini.model.trim().replace(/^models\//, "");
  if (!apiKey) {
    throw new AIError("GEMINI_API_KEY is not configured.", "gemini");
  }

  if (!model) {
    throw new AIError("GEMINI_MODEL is not configured.", "gemini");
  }

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
        ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    logProviderFailure("gemini", model, response.status, details);

    const quotaInfo =
      response.status === 429
        ? parseGeminiQuotaInfo(details)
        : { dailyQuotaExceeded: false };

    const error: AdapterError = new Error(`Gemini returned ${response.status}`);
    error.status = response.status;
    error.quotaExceeded = quotaInfo.dailyQuotaExceeded;

    if (quotaInfo.dailyQuotaExceeded) {
      error.retryable = false;
      error.publicMessage =
        "The daily AI generation limit has been reached. " +
        "Please use saved study materials or try again after the quota resets.";
    } else {
      error.retryable = isRetryableStatus(response.status);
      error.retryAfterMs =
        parseRetryAfterHeader(response.headers.get("retry-after")) ??
        quotaInfo.retryAfterMs;
      error.publicMessage = publicProviderError("Gemini", response.status);
    }

    throw error;
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
    promptFeedback?: { blockReason?: string };
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";

  const tokensUsed =
    (data.usageMetadata?.promptTokenCount ?? 0) +
    (data.usageMetadata?.candidatesTokenCount ?? 0);

  if (!text.trim()) {
    const blockReason =
      data.promptFeedback?.blockReason ??
      data.candidates?.[0]?.finishReason ??
      "unknown reason";

    const error: AdapterError = new Error(
      `Gemini returned an empty response (${blockReason})`,
    );
    error.status = 502;
    error.retryable = true;
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

// ─── Public entry points ─────────────────────────────────────────────────────

const ADAPTERS: Record<
  AIProvider,
  (options: AIGenerateOptions, signal: AbortSignal) => Promise<AIGenerateResult>
> = {
  openai: callOpenAI,
  gemini: callGemini,
};

export async function generate(
  options: AIGenerateOptions,
): Promise<AIGenerateResult> {
  const provider = AI_CONFIG.activeProvider;
  const adapter = ADAPTERS[provider];
  const maxAttempts = Math.max(1, AI_CONFIG.maxRetries + 1);
  const startedAt = Date.now();
  const usageLabel = options.usageLabel?.trim() || "generation";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AI_CONFIG.requestTimeoutMs,
    );

    try {
      const result = await adapter(options, controller.signal);
      await recordAIUsage({
        userId: options.userId ?? null,
        noteId: options.noteId ?? null,
        provider: result.provider,
        model: result.model,
        usageLabel,
        success: true,
        tokensUsed: result.tokensUsed,
        latencyMs: Date.now() - startedAt,
        statusCode: 200,
        quotaExceeded: false,
      });

      return result;
    } catch (unknownError) {
      const error = asAdapterError(unknownError);
      const isAbort = error.name === "AbortError";
      const status = error.status;
      const retryable =
        isAbort ||
        error.retryable === true ||
        (error.retryable !== false &&
          typeof status === "number" &&
          isRetryableStatus(status));
      const isLastAttempt = attempt === maxAttempts - 1;

      if (!retryable || isLastAttempt) {
        await recordAIUsage({
          userId: options.userId ?? null,
          noteId: options.noteId ?? null,
          provider,
          model: configuredModel(provider),
          usageLabel,
          success: false,
          tokensUsed: 0,
          latencyMs: Date.now() - startedAt,
          statusCode:
            typeof status === "number"
              ? status
              : null,
          quotaExceeded:
            error.quotaExceeded === true,
        });

        if (isAbort) {
          throw new AIError(
            `AI request timed out after ${AI_CONFIG.requestTimeoutMs}ms`,
            provider,
          );
        }

        throw new AIError(
          error.publicMessage ??
            error.message ??
            "The AI request could not be completed.",
          provider,
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

  throw new AIError("The AI request could not be completed.", provider);
}

/** Adapter matching the intelligence engine's `(prompt) => result` contract. */
export async function generateForIntelligence(
  prompt: string,
  context: {
    userId?: string;
    noteId?: string;
  } = {},
): Promise<AIGenerateResult> {
  return generate({
    prompt,
    systemPrompt: [
      "You assist a symbolic document-intelligence pipeline.",
      "Extract only facts supported by the supplied document excerpt.",
      "Do not invent methods, datasets, accuracy values, or research problems.",
      "Return only valid JSON.",
    ].join(" "),
    maxTokens: 1_400,
    temperature: 0.1,
    jsonMode: true,
    usageLabel: "intelligence",
    userId: context.userId,
    noteId: context.noteId,
  });
}

import { AI_CONFIG } from "@/server/config/ai_config";
import { AIError } from "@/server/utils/errors";
import { recordAIUsage } from "@/server/services/ai-usage.service";
import { classifyProviderFailure } from "@/server/utils/provider-error";

export interface VisionImage {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}

export interface VisionUsageContext {
  userId?: string;
  noteId?: string;
  usageLabel?: string;
}

export interface VisionGenerateInput {
  prompt: string;
  images: VisionImage[];
  maxTokens?: number;
  usage?: VisionUsageContext;
}

export interface VisionGenerateResult {
  text: string;
  provider: "openai" | "gemini";
  model: string;
}

function toDataUrl(image: VisionImage): string {
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

async function recordVisionUsage(
  input: VisionGenerateInput,
  event: {
    provider: "openai" | "gemini";
    model: string;
    success: boolean;
    tokensUsed: number;
    latencyMs: number;
    statusCode?: number | null;
    quotaExceeded?: boolean;
  },
): Promise<void> {
  if (!input.usage) {
    return;
  }

  await recordAIUsage({
    userId: input.usage.userId ?? null,
    noteId: input.usage.noteId ?? null,
    provider: event.provider,
    model: event.model,
    usageLabel: input.usage.usageLabel?.trim() || "ocr",
    success: event.success,
    tokensUsed: event.tokensUsed,
    latencyMs: event.latencyMs,
    statusCode: event.statusCode ?? null,
    quotaExceeded: event.quotaExceeded ?? false,
  });
}

function visionFailureInfo(error: unknown): {
  statusCode: number | null;
  quotaExceeded: boolean;
} {
  const failure = classifyProviderFailure(error);

  return {
    statusCode: failure.statusCode ?? null,
    quotaExceeded: failure.kind === "quota-exhausted",
  };
}

async function generateWithOpenAI(
  input: VisionGenerateInput,
): Promise<VisionGenerateResult> {
  const apiKey = AI_CONFIG.openai.apiKey.trim();
  const model = AI_CONFIG.openai.model.trim();

  if (!apiKey) {
    throw new AIError("OPENAI_API_KEY is not configured.", "openai");
  }

  const startedAt = Date.now();
  let telemetryRecorded = false;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_CONFIG.requestTimeoutMs,
  );

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: input.prompt },
              ...input.images.map((image) => ({
                type: "input_image",
                image_url: toDataUrl(image),
                detail: "high",
              })),
            ],
          },
        ],
        max_output_tokens: input.maxTokens ?? 4_000,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      const failureError = new Error(
        `OpenAI vision request failed (${response.status}): ${details.slice(0, 300)}`,
      );
      const failure = visionFailureInfo(failureError);
      await recordVisionUsage(input, {
        provider: "openai",
        model,
        success: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        quotaExceeded: failure.quotaExceeded,
      });
      telemetryRecorded = true;
      throw new AIError(failureError.message, "openai");
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
    };

    const text =
      data.output_text ??
      data.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("\n") ??
      "";

    if (!text.trim()) {
      await recordVisionUsage(input, {
        provider: "openai",
        model,
        success: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startedAt,
        statusCode: 502,
        quotaExceeded: false,
      });
      telemetryRecorded = true;
      throw new AIError("OpenAI vision returned no readable text.", "openai");
    }

    const tokensUsed =
      data.usage?.total_tokens ??
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    await recordVisionUsage(input, {
      provider: "openai",
      model,
      success: true,
      tokensUsed,
      latencyMs: Date.now() - startedAt,
      statusCode: 200,
      quotaExceeded: false,
    });
    telemetryRecorded = true;

    return { text: text.trim(), provider: "openai", model };
  } catch (error) {
    if (!telemetryRecorded) {
      const failure = visionFailureInfo(error);
      await recordVisionUsage(input, {
        provider: "openai",
        model,
        success: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startedAt,
        statusCode: failure.statusCode,
        quotaExceeded: failure.quotaExceeded,
      });
    }

    if (error instanceof AIError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIError(
        `OpenAI vision request timed out after ${AI_CONFIG.requestTimeoutMs}ms`,
        "openai",
      );
    }
    throw new AIError(
      error instanceof Error ? error.message : "OpenAI vision request failed.",
      "openai",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGemini(
  input: VisionGenerateInput,
): Promise<VisionGenerateResult> {
  const apiKey = AI_CONFIG.gemini.apiKey.trim();
  const model = AI_CONFIG.gemini.model.trim().replace(/^models\//, "");

  if (!apiKey) {
    throw new AIError("GEMINI_API_KEY is not configured.", "gemini");
  }
  if (!model) {
    throw new AIError("GEMINI_MODEL is not configured.", "gemini");
  }

  const startedAt = Date.now();
  let telemetryRecorded = false;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_CONFIG.requestTimeoutMs,
  );

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: input.prompt },
                ...input.images.map((image) => ({
                  inline_data: {
                    mime_type: image.mimeType,
                    data: image.buffer.toString("base64"),
                  },
                })),
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: input.maxTokens ?? 4_000,
          },
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      const failureError = new Error(
        `Gemini vision request failed (${response.status}): ${details.slice(0, 300)}`,
      );
      const failure = visionFailureInfo(failureError);
      await recordVisionUsage(input, {
        provider: "gemini",
        model,
        success: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        quotaExceeded: failure.quotaExceeded,
      });
      telemetryRecorded = true;
      throw new AIError(failureError.message, "gemini");
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n") ?? "";

    if (!text.trim()) {
      await recordVisionUsage(input, {
        provider: "gemini",
        model,
        success: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startedAt,
        statusCode: 502,
        quotaExceeded: false,
      });
      telemetryRecorded = true;
      throw new AIError("Gemini vision returned no readable text.", "gemini");
    }

    const tokensUsed =
      data.usageMetadata?.totalTokenCount ??
      (data.usageMetadata?.promptTokenCount ?? 0) +
        (data.usageMetadata?.candidatesTokenCount ?? 0);

    await recordVisionUsage(input, {
      provider: "gemini",
      model,
      success: true,
      tokensUsed,
      latencyMs: Date.now() - startedAt,
      statusCode: 200,
      quotaExceeded: false,
    });
    telemetryRecorded = true;

    return { text: text.trim(), provider: "gemini", model };
  } catch (error) {
    if (!telemetryRecorded) {
      const failure = visionFailureInfo(error);
      await recordVisionUsage(input, {
        provider: "gemini",
        model,
        success: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startedAt,
        statusCode: failure.statusCode,
        quotaExceeded: failure.quotaExceeded,
      });
    }

    if (error instanceof AIError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIError(
        `Gemini vision request timed out after ${AI_CONFIG.requestTimeoutMs}ms`,
        "gemini",
      );
    }
    throw new AIError(
      error instanceof Error ? error.message : "Gemini vision request failed.",
      "gemini",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateFromImages(
  input: VisionGenerateInput,
): Promise<VisionGenerateResult> {
  if (!input.prompt.trim()) {
    throw new AIError("Vision prompt cannot be empty.");
  }

  if (input.images.length === 0) {
    throw new AIError("At least one image is required for vision processing.");
  }

  switch (AI_CONFIG.activeProvider) {
    case "openai":
      return generateWithOpenAI(input);

    case "gemini":
      return generateWithGemini(input);

    default:
      throw new AIError(
        `Unsupported vision provider: ${String(AI_CONFIG.activeProvider)}`,
      );
  }
}

import { AI_CONFIG } from "@/server/config/ai_config";
import { AIError } from "@/server/utils/errors";

export interface VisionImage {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}

export interface VisionGenerateInput {
  prompt: string;
  images: VisionImage[];
  maxTokens?: number;
}

export interface VisionGenerateResult {
  text: string;
  provider: "openai" | "gemini";
  model: string;
}

function toDataUrl(image: VisionImage): string {
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

async function generateWithOpenAI(
  input: VisionGenerateInput,
): Promise<VisionGenerateResult> {
  const apiKey = AI_CONFIG.openai.apiKey.trim();
  const model = AI_CONFIG.openai.model.trim();

  if (!apiKey) {
    throw new AIError("OPENAI_API_KEY is not configured.", "openai");
  }

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
              {
                type: "input_text",
                text: input.prompt,
              },

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

      throw new AIError(
        `OpenAI vision request failed (${response.status}): ${details.slice(
          0,
          300,
        )}`,
        "openai",
      );
    }

    const data = (await response.json()) as {
      output_text?: string;

      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
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
      throw new AIError("OpenAI vision returned no readable text.", "openai");
    }

    return {
      text: text.trim(),
      provider: "openai",
      model,
    };
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }

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

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    AI_CONFIG.requestTimeoutMs,
  );

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
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
                {
                  text: input.prompt,
                },

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

      throw new AIError(
        `Gemini vision request failed (${response.status}): ${details.slice(
          0,
          300,
        )}`,
        "gemini",
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n") ?? "";

    if (!text.trim()) {
      throw new AIError("Gemini vision returned no readable text.", "gemini");
    }

    return {
      text: text.trim(),
      provider: "gemini",
      model,
    };
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }

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

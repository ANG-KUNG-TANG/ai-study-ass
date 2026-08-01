import { generate } from "@/server/services/ai.service";
import { buildSummaryPrompt } from "@/server/services/summary/summary.promt";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import { buildSymbolicSummary } from "@/server/services/symbolic-content.service";
import { NotFoundError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type {
  GenerationMetadata,
  GenerationSource,
} from "@/server/types/generation";

export interface SummaryResult extends GenerationMetadata {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  cached: boolean;
}

interface RawSummaryJSON {
  summary?: unknown;
  keyPoints?: unknown;
  importantConcepts?: unknown;
}

function parseSummaryResponse(rawText: string): {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
} {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");

  const parsed = JSON.parse(cleaned) as RawSummaryJSON;

  if (
    typeof parsed.summary !== "string" ||
    parsed.summary.trim().length === 0
  ) {
    throw new Error('AI summary response is missing "summary".');
  }

  if (
    !Array.isArray(parsed.keyPoints) ||
    !parsed.keyPoints.every((item) => typeof item === "string")
  ) {
    throw new Error('AI summary response "keyPoints" must be a string array.');
  }

  if (
    !Array.isArray(parsed.importantConcepts) ||
    !parsed.importantConcepts.every((item) => typeof item === "string")
  ) {
    throw new Error(
      'AI summary response "importantConcepts" must be a string array.',
    );
  }

  return {
    summary: parsed.summary.trim(),
    keyPoints: parsed.keyPoints,
    importantConcepts: parsed.importantConcepts,
  };
}

function formatForStorage(parts: {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
}): string {
  const keyPointsBlock = parts.keyPoints.length
    ? `\n\n## Key Points\n${parts.keyPoints.map((item) => `- ${item}`).join("\n")}`
    : "";

  const conceptBlock = parts.importantConcepts.length
    ? `\n\n## Important Concepts\n${parts.importantConcepts
        .map((item) => `- ${item}`)
        .join("\n")}`
    : "";

  return `${parts.summary}${keyPointsBlock}${conceptBlock}`
    .slice(0, 4_800)
    .trim();
}

export async function generateSummary(
  noteId: string,
  options: { force?: boolean } = {},
): Promise<SummaryResult> {
  const note = await noteRepo.findById(noteId);

  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  if (!options.force && note.summary?.trim()) {
    return {
      summary: note.summary,
      keyPoints: [],
      importantConcepts: [],
      cached: true,
      source: "symbolic",
      confidence: 1,
      aiFallbackUsed: false,
      status: "ready",
      tokensUsed: 0,
      itemCount: 1,
    };
  }

  const intelligence = await intelligenceService
    .getOrRunPipeline(noteId)
    .catch((error: unknown) => {
      logger.warn("Summary is continuing without intelligence data", {
        noteId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

  const symbolic = buildSymbolicSummary(
    intelligence?.core,
    note.content,
    note.title,
  );

  let structured = {
    summary: symbolic.summary,
    keyPoints: symbolic.keyPoints,
    importantConcepts: symbolic.importantConcepts,
  };

  let source: GenerationSource = "symbolic";
  let confidence = symbolic.confidence;
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const needsFallback =
    symbolic.status === "partial" ||
    symbolic.confidence < 0.72 ||
    symbolic.keyPoints.length < 3;

  if (needsFallback) {
    try {
      const { systemPrompt, prompt } = buildSummaryPrompt(note.content);
      const aiResult = await generate({
        prompt,
        systemPrompt:
          `${systemPrompt}\n\nA symbolic draft already exists. ` +
          "Use the source to fill missing details; do not invent facts.",
        jsonMode: true,
        temperature: 0.25,
        maxTokens: 1_600,
      });

      structured = parseSummaryResponse(aiResult.text);
      source =
        symbolic.summary.length >= 180
          ? "hybrid"
          : "ai_fallback";
      confidence = Math.max(symbolic.confidence, 0.78);
      aiFallbackUsed = true;
      tokensUsed = aiResult.tokensUsed;
    } catch (error) {
      logger.warn(
        "AI summary fallback unavailable; saving symbolic summary",
        {
          noteId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );
    }
  }

  const flattened =
    source === "symbolic"
      ? symbolic.summary.slice(0, 4_800).trim()
      : formatForStorage(structured);

  await noteRepo.updateSummary(noteId, flattened);

  const status =
    flattened.length >= 350 && structured.keyPoints.length >= 2
      ? "ready"
      : "partial";

  return {
    summary: flattened,
    keyPoints: structured.keyPoints,
    importantConcepts: structured.importantConcepts,
    cached: false,
    source,
    confidence,
    aiFallbackUsed,
    status,
    tokensUsed,
    itemCount: 1,
  };
}

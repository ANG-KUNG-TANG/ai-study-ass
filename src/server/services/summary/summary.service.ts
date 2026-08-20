import { generate } from "@/server/services/ai.service";
import { buildSummaryPrompt } from "@/server/services/summary/summary.prompt";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import {
  buildReliableSymbolicSummary,
  isReliableCachedSummary,
  mergeAIDraft,
  validateAIDraft,
  type AIStudyNotesDraft,
} from "@/server/services/summary/reliable-summary.service";
import { sampleDocumentContent } from "@/server/services/document-sampling.service";
import { parseJsonObject } from "@/server/utils/structured-output";
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
  qualityScoreOutOf10?: number;
  warnings?: string[];
}

interface RawAIDraft {
  overview?: unknown;
  keyPoints?: unknown;
  importantConcepts?: unknown;
  keyTerms?: unknown;
  unresolvedAssumptions?: unknown;
}

function cleanString(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .filter((item): item is string => typeof item === "string")
    .map(cleanString)
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseAIDraft(rawText: string): AIStudyNotesDraft {
  const parsed = parseJsonObject(rawText) as RawAIDraft;

  if (typeof parsed.overview !== "string" || !parsed.overview.trim()) {
    throw new Error('AI summary response is missing "overview".');
  }

  const keyTerms = Array.isArray(parsed.keyTerms)
    ? parsed.keyTerms
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const object = item as Record<string, unknown>;

          if (
            typeof object.term !== "string" ||
            typeof object.definition !== "string"
          ) {
            return null;
          }

          const term = cleanString(object.term);
          const definition = cleanString(object.definition);
          if (!term || !definition) return null;

          return { term, definition };
        })
        .filter(
          (item): item is { term: string; definition: string } => item !== null,
        )
    : [];

  return {
    overview: cleanString(parsed.overview),
    keyPoints: parseStringArray(parsed.keyPoints),
    importantConcepts: parseStringArray(parsed.importantConcepts),
    keyTerms,
    unresolvedAssumptions: parseStringArray(parsed.unresolvedAssumptions),
  };
}

export async function generateSummary(
  noteId: string,
  options: { force?: boolean } = {},
): Promise<SummaryResult> {
  const note = await noteRepo.findById(noteId);

  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  if (
    !options.force &&
    note.summary?.trim() &&
    isReliableCachedSummary(note.summary)
  ) {
    return {
      summary: note.summary,
      keyPoints: [],
      importantConcepts: [],
      cached: true,
      source: "symbolic",
      confidence: 0.85,
      aiFallbackUsed: false,
      status: "ready",
      tokensUsed: 0,
      itemCount: 1,
    };
  }

  const intelligence = await intelligenceService
    .getOrRunPipeline(noteId)
    .catch((error: unknown) => {
      logger.warn("Summary is continuing without persisted intelligence data", {
        noteId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

  let result = buildReliableSymbolicSummary(
    intelligence?.core,
    note.content,
    note.title,
  );

  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const needsFallback =
    result.status === "partial" ||
    result.confidence < 0.85 ||
    (result.profile?.coverage.missingFields.length ?? 0) > 1;

  if (needsFallback && result.profile?.status !== "rejected") {
    try {
      const groundingText = result.profile?.cleanedText ?? note.content;
      const sample = sampleDocumentContent(groundingText, 28_000);
      const prompt = buildSummaryPrompt({
        content: sample.text,
        profile: result.profile,
        symbolicDraft: result.summary,
      });

      const aiResult = await generate({
        prompt: prompt.prompt,
        systemPrompt: prompt.systemPrompt,
        jsonMode: true,
        temperature: 0.1,
        maxTokens: 2_600,
        usageLabel: "summary",
        userId: note.userId,
        noteId,
      });

      const parsed = parseAIDraft(aiResult.text);
      const validated = validateAIDraft(parsed, groundingText);

      if (validated) {
        result = mergeAIDraft(result, validated);
        source = "hybrid";
        aiFallbackUsed = true;
        tokensUsed = aiResult.tokensUsed;
      } else {
        logger.warn("AI summary fallback failed grounding/quality validation", {
          noteId,
        });
      }
    } catch (error) {
      logger.warn(
        "AI summary fallback unavailable; keeping deterministic notes",
        {
          noteId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  await noteRepo.updateSummary(noteId, result.summary);

  logger.info("Summary generated", {
    noteId,
    source,
    aiFallbackUsed,
    summaryLength: result.summary.length,
    status: result.status,
  });

  return {
    summary: result.summary,
    keyPoints: result.keyPoints,
    importantConcepts: result.importantConcepts,
    cached: false,
    source,
    confidence: result.confidence,
    aiFallbackUsed,
    status: result.status,
    tokensUsed,
    itemCount: 1,
    qualityScoreOutOf10: result.profile?.qualityScoreOutOf10,
    warnings: result.profile?.warnings,
  };
}

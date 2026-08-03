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

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseAIDraft(rawText: string): AIStudyNotesDraft {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned) as RawAIDraft;

  if (typeof parsed.overview !== "string") {
    throw new Error('AI summary response is missing "overview".');
  }

  const keyTerms = Array.isArray(parsed.keyTerms)
    ? parsed.keyTerms
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const object = item as Record<string, unknown>;
          return typeof object.term === "string" && typeof object.definition === "string"
            ? { term: object.term, definition: object.definition }
            : null;
        })
        .filter((item): item is { term: string; definition: string } => item !== null)
    : [];

  return {
    overview: parsed.overview,
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
      const prompt = buildSummaryPrompt({
        content: result.profile?.cleanedText ?? note.content,
        profile: result.profile,
        symbolicDraft: result.summary,
      });
      const aiResult = await generate({
        prompt: prompt.prompt,
        systemPrompt: prompt.systemPrompt,
        jsonMode: true,
        temperature: 0.1,
        maxTokens: 2_000,
        usageLabel: "summary",
      });
      const parsed = parseAIDraft(aiResult.text);
      const validated = validateAIDraft(
        parsed,
        result.profile?.cleanedText ?? note.content,
      );

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
      logger.warn("AI summary fallback unavailable; keeping deterministic notes", {
        noteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await noteRepo.updateSummary(noteId, result.summary);

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

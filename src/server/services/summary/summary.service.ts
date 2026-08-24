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
import {
  buildGroundedStudyNotes,
  getStudyNotesVersionMarker,
} from "@/server/services/summary/grounded-study-notes.service";
import { buildGroundedPromptSource } from "@/server/services/grounded-artifacts.service";
import { getReliableProfile } from "@/server/intelligence/reliability/profile";
import { NotFoundError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type {
  GenerationMetadata,
  GenerationSource,
} from "@/server/types/generation";
import { z } from "zod";
import { isIntelligenceV2Enabled } from "@/server/config/intelligence-v2.config";
import type { SummaryMode } from "@/types/summary";

export interface SummaryResult extends GenerationMetadata {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  mode: SummaryMode;
  cached: boolean;
  qualityScoreOutOf10?: number;
  warnings?: string[];
}

const aiStudyNotesDraftSchema = z.object({
  overview: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
  importantConcepts: z.array(z.string()).default([]),
  keyTerms: z.array(z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
  })).default([]),
  unresolvedAssumptions: z.array(z.string()).default([]),
}).strict();

function parseAIDraft(rawText: string): AIStudyNotesDraft {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  return aiStudyNotesDraftSchema.parse(JSON.parse(cleaned));
}

export async function generateSummary(
  noteId: string,
  options: { force?: boolean; mode?: SummaryMode } = {},
): Promise<SummaryResult> {
  const note = await noteRepo.findById(noteId);
  const v2Enabled = isIntelligenceV2Enabled();
  const requestedMode = options.mode ?? "comprehensive";
  const mode: SummaryMode = v2Enabled
    ? requestedMode
    : "comprehensive";
  const expectedVersionMarker = getStudyNotesVersionMarker(mode);

  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  if (
    !options.force &&
    note.summary?.trim() &&
    (
      v2Enabled
        ? note.summary.includes(expectedVersionMarker)
        : isReliableCachedSummary(note.summary)
    )
  ) {
    return {
      summary: note.summary,
      mode,
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
  const grounding = v2Enabled
    ? intelligence?.grounding ?? null
    : null;

  let result = grounding
    ? buildGroundedStudyNotes(
        grounding,
        getReliableProfile(intelligence?.core),
        note.title,
        { mode },
      )
    : buildReliableSymbolicSummary(
        intelligence?.core,
        note.content,
        note.title,
      );

  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const needsFallback =
    mode === "comprehensive" &&
    (
      result.status === "partial" ||
      result.confidence < 0.85 ||
      (result.profile?.coverage.missingFields.length ?? 0) > 1
    );

  if (needsFallback && result.profile?.status !== "rejected") {
    try {
      const prompt = buildSummaryPrompt({
        content: grounding
          ? buildGroundedPromptSource(grounding)
          : result.profile?.cleanedText ?? note.content,
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
        userId: note.userId,
        noteId,
      });
      const parsed = parseAIDraft(aiResult.text);
      const validated = validateAIDraft(
        parsed,
        grounding
          ? buildGroundedPromptSource(grounding)
          : result.profile?.cleanedText ?? note.content,
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
    mode,
    keyPoints: result.keyPoints,
    importantConcepts: result.importantConcepts,
    cached: false,
    source,
    confidence: result.confidence,
    aiFallbackUsed,
    status: result.status,
    tokensUsed,
    itemCount: 1,
    qualityScoreOutOf10:
      grounding?.quality.scoreOutOf10 ??
      result.profile?.qualityScoreOutOf10,
    warnings: [
      ...(result.profile?.warnings ?? []),
      ...(grounding?.quality.warnings ?? []),
    ],
  };
}

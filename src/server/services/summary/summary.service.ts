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
import {
  buildGroundedSummaryRecovery,
} from "@/server/services/summary/summary-recovery.service";
import {
  assessSummaryQuality,
  summaryQualityLogContext,
  summaryQualityWarnings,
} from "@/server/services/summary/summary-quality.service";
import { retrieveGroundedEvidence } from "@/server/services/evidence-retriever.service";
import { buildSummaryRepairPrompt } from "@/server/services/summary/summary-repair.prompt";
import {
  applySummaryRepairPatch,
  buildSummaryRepairPlan,
  isSummaryRepairImprovement,
  parseSummaryRepairPatch,
  validateSummaryRepairPatch,
} from "@/server/services/summary/summary-targeted-repair.service";
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

  let result:
    | ReturnType<typeof buildGroundedStudyNotes>
    | ReturnType<typeof buildReliableSymbolicSummary>;
  let recoveryUsed = false;

  if (grounding) {
    try {
      result = buildGroundedStudyNotes(
        grounding,
        getReliableProfile(intelligence?.core),
        note.title,
        { mode },
      );
    } catch (error) {
      logger.warn(
        "Grounded study-note construction failed; using strict source-extractive recovery",
        {
          noteId,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      result = buildGroundedSummaryRecovery(
        grounding,
        getReliableProfile(intelligence?.core),
        note.title,
        mode,
      );
      recoveryUsed = true;
    }
  } else {
    result = buildReliableSymbolicSummary(
      intelligence?.core,
      note.content,
      note.title,
    );
  }

  const deterministicResult = result;
  const deterministicQuality = grounding
    ? assessSummaryQuality({
        artifact: {
          summary: result.summary,
          keyPoints: result.keyPoints,
          importantConcepts: result.importantConcepts,
        },
        grounding,
        mode,
      })
    : null;
  const repairPlan = grounding && deterministicQuality
    ? buildSummaryRepairPlan({
        grounding,
        artifact: {
          summary: result.summary,
          keyPoints: result.keyPoints,
          importantConcepts: result.importantConcepts,
        },
        quality: deterministicQuality,
        mode,
      })
    : null;

  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  // Grounded v2 summaries use the summary validator itself as the sufficiency
  // gate. AI is only allowed when a faithful comprehensive summary has a
  // validator-level coverage failure. Warning-level coverage is returned
  // without provider spend. Legacy/non-grounded generation keeps its previous
  // fallback behavior for compatibility.
  const needsFallback = grounding
    ? !recoveryUsed && Boolean(repairPlan?.needed)
    : !recoveryUsed &&
      mode === "comprehensive" &&
      (
        result.status === "partial" ||
        result.confidence < 0.85 ||
        (result.profile?.coverage.missingFields.length ?? 0) > 1
      );

  if (needsFallback && result.profile?.status !== "rejected") {
    try {
      if (grounding && repairPlan?.needed && deterministicQuality) {
        const evidence = retrieveGroundedEvidence(
          grounding,
          repairPlan.evidenceRequest,
        );

        if (!evidence.text) {
          logger.warn(
            "Summary coverage repair was required but no targeted evidence could be retrieved",
            { noteId, gaps: repairPlan.gaps },
          );
        } else {
          const prompt = buildSummaryRepairPrompt({
            evidence: evidence.text,
            gaps: repairPlan.gaps,
            currentKeyPoints: result.keyPoints,
            currentConcepts: result.importantConcepts,
          });
          const aiResult = await generate({
            prompt: prompt.prompt,
            systemPrompt: prompt.systemPrompt,
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 900,
            usageLabel: "summary",
            userId: note.userId,
            noteId,
          });
          tokensUsed = aiResult.tokensUsed;

          const parsed = parseSummaryRepairPatch(aiResult.text);
          const validated = validateSummaryRepairPatch(
            parsed,
            evidence.text,
          );

          if (validated) {
            const candidate = applySummaryRepairPatch(result, validated);
            const candidateQuality = assessSummaryQuality({
              artifact: {
                summary: candidate.summary,
                keyPoints: candidate.keyPoints,
                importantConcepts: candidate.importantConcepts,
              },
              grounding,
              mode,
            });

            if (
              isSummaryRepairImprovement(
                deterministicQuality,
                candidateQuality,
              )
            ) {
              result = candidate;
              source = "hybrid";
              aiFallbackUsed = true;
              logger.info("Applied targeted summary coverage repair", {
                noteId,
                gaps: repairPlan.gaps,
                evidenceCharacters: evidence.characterCount,
                evidenceFacts: evidence.factIds.length,
                promptEvidenceTruncated: prompt.wasTruncated,
                tokensUsed: aiResult.tokensUsed,
              });
            } else {
              logger.warn(
                "Targeted summary repair did not improve grounded coverage; keeping deterministic notes",
                { noteId, gaps: repairPlan.gaps },
              );
            }
          } else {
            logger.warn(
              "Targeted summary repair failed evidence validation; keeping deterministic notes",
              { noteId, gaps: repairPlan.gaps },
            );
          }
        }
      } else {
        const fallbackSource =
          result.profile?.cleanedText ?? note.content;
        const prompt = buildSummaryPrompt({
          content: fallbackSource,
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
        tokensUsed = aiResult.tokensUsed;
        const parsed = parseAIDraft(aiResult.text);
        const validated = validateAIDraft(parsed, fallbackSource);

        if (validated) {
          result = mergeAIDraft(result, validated);
          source = "hybrid";
          aiFallbackUsed = true;
        } else {
          logger.warn("AI summary fallback failed grounding/quality validation", {
            noteId,
          });
        }
      }
    } catch (error) {
      logger.warn("AI summary fallback unavailable; keeping deterministic notes", {
        noteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let summaryQuality = grounding
    ? assessSummaryQuality({
        artifact: {
          summary: result.summary,
          keyPoints: result.keyPoints,
          importantConcepts: result.importantConcepts,
        },
        grounding,
        mode,
      })
    : null;

  if (
    summaryQuality?.status === "failed" &&
    source === "hybrid" &&
    grounding
  ) {
    logger.warn(
      "AI-enhanced summary failed grounded summary validation; reverting to deterministic notes",
      {
        noteId,
        ...summaryQualityLogContext(summaryQuality),
      },
    );

    result = deterministicResult;
    source = "symbolic";
    aiFallbackUsed = false;

    summaryQuality = assessSummaryQuality({
      artifact: {
        summary: result.summary,
        keyPoints: result.keyPoints,
        importantConcepts: result.importantConcepts,
      },
      grounding,
      mode,
    });
  }

  if (
    summaryQuality?.status === "failed" &&
    grounding
  ) {
    const recovery =
      buildGroundedSummaryRecovery(
        grounding,
        getReliableProfile(intelligence?.core),
        note.title,
        mode,
      );

    const recoveryQuality =
      assessSummaryQuality({
        artifact: {
          summary: recovery.summary,
          keyPoints: recovery.keyPoints,
          importantConcepts:
            recovery.importantConcepts,
        },
        grounding,
        mode,
      });

    logger.warn(
      "Grounded summary failed validation; evaluated strict source-extractive recovery",
      {
        noteId,
        original:
          summaryQualityLogContext(
            summaryQuality,
          ),
        recovery:
          summaryQualityLogContext(
            recoveryQuality,
          ),
      },
    );

    if (recoveryQuality.faithful) {
      result = recovery;
      source = "symbolic";
      aiFallbackUsed = false;
      summaryQuality =
        recoveryQuality;
      recoveryUsed = true;
    }
  }

  if (
    summaryQuality?.status === "failed" &&
    !summaryQuality.faithful
  ) {
    logger.error(
      "Grounded summary failed faithfulness validation after strict recovery",
      {
        noteId,
        ...summaryQualityLogContext(summaryQuality),
      },
    );
    throw new Error(
      "Grounded summary failed faithfulness validation",
    );
  }

  if (
    summaryQuality?.status === "failed" &&
    summaryQuality.faithful
  ) {
    logger.warn(
      "Returning faithful partial summary with coverage limitations instead of failing the request",
      {
        noteId,
        ...summaryQualityLogContext(summaryQuality),
      },
    );
  }

  if (summaryQuality?.status === "warning") {
    logger.warn(
      "Grounded summary passed with quality warnings",
      {
        noteId,
        ...summaryQualityLogContext(summaryQuality),
      },
    );
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
      ...(summaryQuality
        ? summaryQualityWarnings(summaryQuality)
        : []),
      ...(recoveryUsed
        ? [
            "A strict source-extractive recovery summary was used because the normal grounded summary could not be returned safely.",
          ]
        : []),
    ],
  };
}

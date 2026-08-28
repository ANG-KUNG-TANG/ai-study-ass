import { generate } from "@/server/services/ai.service";
import {
  buildQuizPrompt,
  resolveOptions,
  type QuizPromptOptions,
} from "@/server/services/quiz/quiz.prompt";
import * as quizRepository from "@/server/repositories/quiz.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import {
  QuizEntity,
  QuizValidationError,
  QUESTION_TYPES,
  type QuizQuestionInput,
} from "@/server/entities/quiz.entity";
import {
  NotFoundError,
  ValidationError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type {
  KnowledgeCore,
  ResolvedConcept,
} from "@/server/intelligence/types";
import { buildQuestionsFromSource } from "@/server/services/symbolic-content.service";
import type {
  GenerationMetadata,
  GenerationSource,
} from "@/server/types/generation";
import {
  buildQuestionsFromGrounding,
} from "@/server/services/grounded-artifacts.service";
import {
  buildQuizSufficiencyPlan,
  retrieveQuizRepairEvidence,
} from "@/server/services/quiz/quiz-sufficiency.service";
import { z } from "zod";
import { isIntelligenceV2Enabled } from "@/server/config/intelligence-v2.config";
import {
  quizQualityLogContext,
  validateGroundedQuizQuestions,
} from "@/server/services/quiz/quiz-quality.service";
import type {
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  buildRepairCacheDescriptor,
  getCachedRepair,
  invalidateCachedRepair,
  saveCachedRepair,
} from "@/server/services/repair-cache.service";
import {
  recordRepairTelemetry,
} from "@/server/services/repair-telemetry.service";

const quizResponseSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(1),
    questionType: z.enum(QUESTION_TYPES),
    options: z.array(z.string()),
    answer: z.string().min(1),
    explanation: z.string().optional(),
  }).strict()),
}).strict();

function parseQuizResponse(rawText: string): QuizQuestionInput[] {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");

  return quizResponseSchema.parse(JSON.parse(cleaned)).questions.map(
    (question): QuizQuestionInput => ({
      ...question,
      question: question.question.trim(),
      answer: question.answer.trim(),
      explanation: question.explanation?.trim(),
    }),
  );
}

function pickDistractors(
  pool: string[],
  correct: string,
  count: number,
): string[] {
  return pool
    .filter(
      (candidate) =>
        candidate.toLowerCase() !== correct.toLowerCase(),
    )
    .slice(0, count);
}

export function buildQuestionsFromCore(
  core: KnowledgeCore,
  ontologyMatches: ResolvedConcept[],
  types: readonly string[],
  count: number,
): QuizQuestionInput[] {
  const questions: QuizQuestionInput[] = [];
  const distractorPool = [
    ...core.entities,
    ...ontologyMatches.map((match) => match.concept.id),
  ].filter((value, index, all) => all.indexOf(value) === index);

  if (core.method && types.includes("multiple_choice")) {
    const distractors = pickDistractors(distractorPool, core.method, 3);

    if (distractors.length > 0) {
      questions.push({
        question: "Which method does this document propose or evaluate?",
        questionType: "multiple_choice",
        options: [core.method, ...distractors],
        answer: core.method,
        explanation: `The extracted method is ${core.method}.`,
      });
    }
  }

  if (core.dataset && types.includes("true_false")) {
    questions.push({
      question: `True or false: the document uses the ${core.dataset} dataset.`,
      questionType: "true_false",
      options: ["True", "False"],
      answer: "True",
      explanation: `The extracted dataset is ${core.dataset}.`,
    });
  }

  if (core.problem && types.includes("short_answer")) {
    questions.push({
      question: "What main problem does this document address?",
      questionType: "short_answer",
      options: [],
      answer: core.problem.slice(0, 300),
      explanation: "The answer comes from the extracted problem statement.",
    });
  }

  if (
    core.accuracy !== null &&
    types.includes("short_answer")
  ) {
    questions.push({
      question: "What performance result is reported?",
      questionType: "short_answer",
      options: [],
      answer: `${core.accuracy}%`,
      explanation: "The value comes from the extracted result.",
    });
  }

  if (types.includes("short_answer")) {
    for (const point of core.keyPoints) {
      questions.push({
        question: `What is stated about "${point.label}"?`,
        questionType: "short_answer",
        options: [],
        answer: point.value.slice(0, 300),
        explanation: "This key point was extracted from the document.",
      });

      if (questions.length >= count) break;
    }

    for (const contribution of core.contributions) {
      if (questions.length >= count) break;

      questions.push({
        question: "Name one contribution of this work.",
        questionType: "short_answer",
        options: [],
        answer: contribution.slice(0, 300),
        explanation: "This is one of the extracted contributions.",
      });
    }
  }

  return questions.slice(0, count);
}

function deduplicateQuestions(
  questions: QuizQuestionInput[],
): QuizQuestionInput[] {
  const seen = new Set<string>();

  return questions.filter((question) => {
    const key = question.question
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateQuestions(
  noteId: string,
  userId: string,
  questions: QuizQuestionInput[],
): QuizQuestionInput[] {
  return questions.filter((question) => {
    try {
       
      new QuizEntity({
        id: "validation-only",
        noteId,
        userId,
        questions: [question],
        createdAt: new Date(),
      });
      return true;
    } catch (error) {
      if (error instanceof QuizValidationError) return false;
      throw error;
    }
  });
}

function validateGroundedQuestions(
  noteId: string,
  questions: QuizQuestionInput[],
  grounding: GroundedKnowledge | null,
): QuizQuestionInput[] {
  if (!grounding) return questions;

  const result = validateGroundedQuizQuestions(
    questions,
    grounding,
  );

  if (result.rejected.length > 0) {
    logger.warn(
      "Quiz questions rejected by grounded quality validation",
      {
        noteId,
        ...quizQualityLogContext(result),
      },
    );
  }

  return result.accepted;
}

export interface GenerateQuizOptions extends QuizPromptOptions {
  dropInvalidQuestions?: boolean;
  force?: boolean;
}

export interface QuizGenerationResult {
  quiz: QuizEntity;
  metadata: GenerationMetadata;
}

export async function generateQuizWithMetadata(
  noteId: string,
  userId: string,
  options: GenerateQuizOptions = {},
): Promise<QuizGenerationResult> {
  const note = await noteRepo.findByIdAndUserId(
    noteId,
    userId,
  );

  if (!note) {
    throw new NotFoundError("Note");
  }

  if (!note.content.trim()) {
    throw new ValidationError(
      `Note ${noteId} has no extracted content to generate a quiz from.`,
    );
  }

  const existing = await quizRepository.findLatestByNote(noteId, userId);

  if (existing && !options.force) {
    return {
      quiz: existing,
      metadata: {
        source: "symbolic",
        confidence: 1,
        aiFallbackUsed: false,
        status: "ready",
        itemCount: existing.toJSON().questions.length,
        tokensUsed: 0,
      },
    };
  }

  const { count, types } = resolveOptions(options);
  const intelligence = await intelligenceService
    .getOrRunPipeline(noteId)
    .catch(() => null);
  const grounding = isIntelligenceV2Enabled()
    ? intelligence?.grounding ?? null
    : null;

  const coreQuestions =
    intelligence?.core
      ? buildQuestionsFromCore(
          intelligence.core,
          intelligence.ontology ?? [],
          types,
          count,
        )
      : [];

  const groundedQuestions = grounding
    ? buildQuestionsFromGrounding(
        grounding,
        count,
        types,
      )
    : [];

  const sourceQuestions = grounding
    ? []
    : buildQuestionsFromSource(
        note.content,
        count,
        types,
      );

  let questions = deduplicateQuestions([
    ...groundedQuestions,
    ...coreQuestions,
    ...sourceQuestions,
  ]).slice(0, count);

  questions = validateQuestions(
    noteId,
    userId,
    questions,
  );
  questions = validateGroundedQuestions(
    noteId,
    questions,
    grounding,
  );

  const symbolicCount = questions.length;
  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const repairStrategyVersion =
    "quiz-sufficiency-v1";
  let repairAttempted = false;
  let repairCacheHit = false;
  let repairAccepted = false;
  let repairEvidenceCharacters = 0;

  const sufficiency =
    buildQuizSufficiencyPlan({
      targetCount: count,
      acceptedCount: questions.length,
      qualityValidated:
        Boolean(grounding),
    });

  if (
    grounding &&
    !sufficiency.needsAI &&
    sufficiency.targetShortfall > 0
  ) {
    logger.info(
      "Returning sufficient grounded quiz without AI target fill",
      {
        noteId,
        targetCount: count,
        minimumAcceptableCount:
          sufficiency.minimumAcceptableCount,
        acceptedCount:
          questions.length,
        targetShortfall:
          sufficiency.targetShortfall,
      },
    );
  }

  if (sufficiency.needsAI) {
    const repairEvidence =
      grounding
        ? retrieveQuizRepairEvidence(
            grounding,
            questions,
            sufficiency.requestedAIAdditions,
          )
        : null;
    const sourceText =
      grounding
        ? repairEvidence?.text ?? ""
        : note.content;

    if (
      grounding &&
      !sourceText.trim()
    ) {
      logger.warn(
        "Quiz AI completion was needed but no targeted grounded evidence was available",
        {
          noteId,
          targetCount: count,
          minimumAcceptableCount:
            sufficiency.minimumAcceptableCount,
          acceptedCount:
            questions.length,
          requestedAIAdditions:
            sufficiency.requestedAIAdditions,
        },
      );
    } else {
      try {
        if (
          grounding &&
          repairEvidence
        ) {
          repairEvidenceCharacters =
            repairEvidence.characterCount;

          logger.info(
            "Prepared targeted quiz repair evidence",
            {
              noteId,
              targetCount: count,
              minimumAcceptableCount:
                sufficiency.minimumAcceptableCount,
              acceptedCount:
                questions.length,
              requestedAIAdditions:
                sufficiency.requestedAIAdditions,
              evidenceCharacters:
                repairEvidence.characterCount,
              evidenceFacts:
                repairEvidence.factIds.length,
              evidenceSections:
                repairEvidence.sectionIds.length,
              evidenceTruncated:
                repairEvidence.wasTruncated,
            },
          );
        }

        const cacheDescriptor =
          grounding
            ? buildRepairCacheDescriptor({
                noteId,
                userId,
                feature: "quiz",
                sourceText:
                  note.content,
                variant: [
                  `count=${count}`,
                  `types=${[...types]
                    .sort()
                    .join(",")}`,
                ].join(";"),
                gapParts: [
                  `requested=${sufficiency.requestedAIAdditions}`,
                  ...questions.map(
                    (question) =>
                      `existing=${question.question}`,
                  ),
                ],
                strategyVersion:
                  repairStrategyVersion,
              })
            : null;
        let cacheApplied = false;

        if (
          cacheDescriptor &&
          !options.force
        ) {
          const cached =
            await getCachedRepair<unknown>(
              cacheDescriptor,
            );

          if (cached) {
            try {
              const cachedQuestions =
                parseQuizResponse(
                  JSON.stringify(
                    cached,
                  ),
                );
              const combined =
                deduplicateQuestions([
                  ...questions,
                  ...cachedQuestions,
                ]).slice(
                  0,
                  count,
                );
              const structurallyValid =
                validateQuestions(
                  noteId,
                  userId,
                  combined,
                );
              const validated =
                validateGroundedQuestions(
                  noteId,
                  structurallyValid,
                  grounding,
                );

              if (
                validated.length >
                  questions.length &&
                validated.length >=
                  sufficiency.minimumAcceptableCount
              ) {
                questions =
                  validated;
                source =
                  symbolicCount > 0
                    ? "hybrid"
                    : "ai_fallback";
                aiFallbackUsed =
                  true;
                repairCacheHit =
                  true;
                repairAccepted =
                  true;
                cacheApplied =
                  true;

                logger.info(
                  "Applied cached targeted quiz repair",
                  {
                    noteId,
                    providerCallAvoided:
                      true,
                    acceptedCount:
                      questions.length,
                  },
                );
              }
            } catch (error) {
              logger.warn(
                "Cached quiz repair failed validation; invalidating cache entry",
                {
                  noteId,
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
              );
            }

            if (!cacheApplied) {
              await invalidateCachedRepair(
                cacheDescriptor,
              );
            }
          }
        }

        if (!cacheApplied) {
          const {
            systemPrompt,
            prompt,
          } = buildQuizPrompt(
            sourceText,
            {
              ...options,
              questionCount:
                sufficiency.requestedAIAdditions,
            },
          );

          repairAttempted =
            Boolean(grounding);

          const aiResult =
            await generate({
              prompt,
              systemPrompt,
              jsonMode: true,
              temperature: 0.35,
              maxTokens: 2_000,
              usageLabel: "quiz",
              userId,
              noteId,
            });

          const aiQuestions =
            parseQuizResponse(
              aiResult.text,
            );
          const combined =
            deduplicateQuestions([
              ...questions,
              ...aiQuestions,
            ]).slice(0, count);
          const structurallyValid =
            validateQuestions(
              noteId,
              userId,
              combined,
            );
          const validated =
            validateGroundedQuestions(
              noteId,
              structurallyValid,
              grounding,
            );
          const acceptedAIContent =
            validated.length >
            questions.length;
          const repairReachedMinimum =
            validated.length >=
            sufficiency.minimumAcceptableCount;

          questions = validated;
          tokensUsed =
            aiResult.tokensUsed;

          if (acceptedAIContent) {
            source =
              symbolicCount > 0
                ? "hybrid"
                : "ai_fallback";
            aiFallbackUsed = true;
            repairAccepted =
              Boolean(
                grounding &&
                repairReachedMinimum,
              );

            if (
              cacheDescriptor &&
              grounding &&
              repairReachedMinimum
            ) {
              await saveCachedRepair(
                cacheDescriptor,
                {
                  questions:
                    aiQuestions,
                },
              );
            }
          }
        }
      } catch (error) {
        logger.warn(
          "AI quiz fallback unavailable; keeping symbolic questions",
          {
            noteId,
            requested: count,
            minimumAcceptableCount:
              sufficiency.minimumAcceptableCount,
            requestedAIAdditions:
              sufficiency.requestedAIAdditions,
            symbolicCount,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );
      }
    }
  }

  questions = validateQuestions(
    noteId,
    userId,
    questions,
  );
  questions = validateGroundedQuestions(
    noteId,
    questions,
    grounding,
  );

  if (questions.length === 0) {
    throw new ValidationError(
      "No valid quiz questions could be generated from this document.",
    );
  }

  if (options.force && existing) {
    await quizRepository.deleteByNoteId(noteId);
  }

  const quiz = await quizRepository.create({
    noteId,
    userId,
    questions,
  });

  const confidence = Math.min(
    1,
    0.35 +
      (questions.length / count) * 0.45 +
      (intelligence?.confidence ?? 0) * 0.2,
  );

  const status =
    questions.length >=
      sufficiency.minimumAcceptableCount
      ? "ready"
      : "partial";

  if (
    grounding &&
    sufficiency.needsAI
  ) {
    repairAccepted =
      repairAccepted &&
      questions.length >=
        sufficiency.minimumAcceptableCount;

    await recordRepairTelemetry({
      noteId,
      userId,
      feature: "quiz",
      strategyVersion:
        repairStrategyVersion,
      repairNeeded: true,
      repairAttempted,
      repairCacheHit,
      repairAccepted,
      providerCallAvoided:
        repairCacheHit &&
        repairAccepted &&
        !repairAttempted,
      evidenceCharacters:
        repairEvidenceCharacters,
      tokensUsed,
      gapCodes: [
        `TARGET_SHORTFALL_${sufficiency.targetShortfall}`,
        `MINIMUM_ACCEPTABLE_${sufficiency.minimumAcceptableCount}`,
      ],
    });
  }

  logger.info("Quiz generated", {
    noteId,
    userId,
    count: questions.length,
    targetCount: count,
    minimumAcceptableCount:
      sufficiency.minimumAcceptableCount,
    source,
    aiFallbackUsed,
    tokensUsed,
  });

  return {
    quiz,
    metadata: {
      source,
      confidence,
      aiFallbackUsed,
      status,
      itemCount: questions.length,
      tokensUsed,
    },
  };
}

export async function generateQuiz(
  noteId: string,
  userId: string,
  options: GenerateQuizOptions = {},
): Promise<QuizEntity> {
  return (await generateQuizWithMetadata(noteId, userId, options)).quiz;
}

export async function getQuiz(
  quizId: string,
  userId: string,
): Promise<QuizEntity> {
  const quiz = await quizRepository.findByIdAndUserId(
    quizId,
    userId,
  );

  if (!quiz) {
    throw new NotFoundError("Quiz");
  }

  return quiz;
}

export async function getLatestQuizByNote(
  noteId: string,
  userId: string,
): Promise<QuizEntity> {
  const quiz = await quizRepository.findLatestByNote(noteId, userId);

  if (!quiz) {
    throw new NotFoundError(
      `No quiz has been generated yet for note ${noteId}`,
    );
  }

  return quiz;
}

export async function getAllQuizzesByNote(
  noteId: string,
  userId: string,
): Promise<QuizEntity[]> {
  return quizRepository.findAllByNote(noteId, userId);
}

export async function deleteForNote(noteId: string): Promise<void> {
  await quizRepository.deleteByNoteId(noteId);
  logger.info("Quiz data deleted", { noteId });
}

export async function getAllQuizzesByUser(userId: string) {
  return quizRepository.findAllByUser(userId);
}

export async function deleteQuiz(
  quizId: string,
  userId: string,
): Promise<void> {
  const deleted =
    await quizRepository.deleteByIdAndUserId(
      quizId,
      userId,
    );

  if (!deleted) {
    throw new NotFoundError("Quiz");
  }
}

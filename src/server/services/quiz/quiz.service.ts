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

interface RawQuizJSON {
  questions?: unknown;
}

interface RawQuestionJSON {
  question?: unknown;
  questionType?: unknown;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
}

function parseQuizResponse(rawText: string): QuizQuestionInput[] {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");

  const parsed = JSON.parse(cleaned) as RawQuizJSON;

  if (!Array.isArray(parsed.questions)) {
    throw new Error('AI quiz response is missing a "questions" array.');
  }

  return parsed.questions.map((raw, index): QuizQuestionInput => {
    const question = raw as RawQuestionJSON;

    if (typeof question.question !== "string") {
      throw new Error(`questions[${index}].question must be a string.`);
    }

    if (
      typeof question.questionType !== "string" ||
      !QUESTION_TYPES.includes(question.questionType as never)
    ) {
      throw new Error(`questions[${index}].questionType is invalid.`);
    }

    if (
      !Array.isArray(question.options) ||
      !question.options.every((option) => typeof option === "string")
    ) {
      throw new Error(`questions[${index}].options must be a string array.`);
    }

    if (typeof question.answer !== "string") {
      throw new Error(`questions[${index}].answer must be a string.`);
    }

    return {
      question: question.question.trim(),
      questionType:
        question.questionType as QuizQuestionInput["questionType"],
      options: question.options,
      answer: question.answer.trim(),
      explanation:
        typeof question.explanation === "string"
          ? question.explanation.trim()
          : undefined,
    };
  });
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

  const coreQuestions =
    intelligence?.core
      ? buildQuestionsFromCore(
          intelligence.core,
          intelligence.ontology ?? [],
          types,
          count,
        )
      : [];

  const sourceQuestions = buildQuestionsFromSource(
    note.content,
    count,
    types,
  );

  let questions = deduplicateQuestions([
    ...coreQuestions,
    ...sourceQuestions,
  ]).slice(0, count);

  const symbolicCount = questions.length;
  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const missingCount = Math.max(0, count - questions.length);

  if (missingCount > 0) {
    try {
      const { systemPrompt, prompt } = buildQuizPrompt(note.content, {
        ...options,
        questionCount: missingCount,
      });

      const aiResult = await generate({
        prompt,
        systemPrompt,
        jsonMode: true,
        temperature: 0.35,
        maxTokens: 2_000,
        usageLabel: "quiz",
        userId,
        noteId,
      });

      const aiQuestions = parseQuizResponse(aiResult.text);
      questions = deduplicateQuestions([
        ...questions,
        ...aiQuestions,
      ]).slice(0, count);

      source = symbolicCount > 0 ? "hybrid" : "ai_fallback";
      aiFallbackUsed = true;
      tokensUsed = aiResult.tokensUsed;
    } catch (error) {
      logger.warn(
        "AI quiz fallback unavailable; keeping symbolic questions",
        {
          noteId,
          requested: count,
          symbolicCount,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );
    }
  }

  questions = validateQuestions(noteId, userId, questions);

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
    questions.length >= Math.max(3, Math.ceil(count * 0.7))
      ? "ready"
      : "partial";

  logger.info("Quiz generated", {
    noteId,
    userId,
    count: questions.length,
    source,
    aiFallbackUsed,
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

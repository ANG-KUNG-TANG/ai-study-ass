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
  ForbiddenError,
  ValidationError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type {
  KnowledgeCore,
  ResolvedConcept,
} from "@/server/intelligence/types";
import { buildQuestionsFromSource } from "@/server/services/symbolic-content.service";
import { sampleDocumentContent } from "@/server/services/document-sampling.service";
import { parseStructuredArray } from "@/server/utils/structured-output";
import type {
  GenerationMetadata,
  GenerationSource,
} from "@/server/types/generation";

interface RawQuestionJSON {
  question?: unknown;
  questionType?: unknown;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
}

function normalizeQuestionType(
  value: unknown,
): QuizQuestionInput["questionType"] | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s/-]+/g, "_");

  const aliases: Record<string, QuizQuestionInput["questionType"]> = {
    multiple_choice: "multiple_choice",
    multiplechoice: "multiple_choice",
    mcq: "multiple_choice",
    true_false: "true_false",
    truefalse: "true_false",
    short_answer: "short_answer",
    shortanswer: "short_answer",
  };

  return aliases[normalized] ?? null;
}

function parseQuizQuestion(raw: unknown): QuizQuestionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const question = raw as RawQuestionJSON;

  if (
    typeof question.question !== "string" ||
    typeof question.answer !== "string"
  ) {
    return null;
  }

  const questionType = normalizeQuestionType(question.questionType);
  if (!questionType || !QUESTION_TYPES.includes(questionType)) return null;

  if (!Array.isArray(question.options)) return null;
  const options = question.options
    .filter((option): option is string => typeof option === "string")
    .map((option) => option.trim())
    .filter(Boolean);

  const questionText = question.question.trim();
  let answer = question.answer.trim();
  if (!questionText || !answer) return null;

  if (questionType === "multiple_choice") {
    const matchedOption = options.find(
      (option) => option.toLowerCase() === answer.toLowerCase(),
    );
    if (!matchedOption || options.length < 2 || options.length > 6) return null;
    answer = matchedOption;
  }

  if (questionType === "true_false") {
    const normalizedAnswer = answer.toLowerCase();
    if (normalizedAnswer !== "true" && normalizedAnswer !== "false")
      return null;
    answer = normalizedAnswer === "true" ? "True" : "False";
  }

  return {
    question: questionText.slice(0, 600),
    questionType,
    options:
      questionType === "short_answer"
        ? []
        : questionType === "true_false"
          ? ["True", "False"]
          : options,
    answer: answer.slice(0, 500),
    explanation:
      typeof question.explanation === "string"
        ? question.explanation.trim().slice(0, 700)
        : undefined,
  };
}

function parseQuizResponse(rawText: string): {
  questions: QuizQuestionInput[];
  recovered: boolean;
} {
  const result = parseStructuredArray(rawText, "questions", parseQuizQuestion);
  return { questions: result.items, recovered: result.recovered };
}

function pickDistractors(
  pool: string[],
  correct: string,
  count: number,
): string[] {
  return pool
    .filter((candidate) => candidate.toLowerCase() !== correct.toLowerCase())
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

  if (core.accuracy !== null && types.includes("short_answer")) {
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
    const key = question.question.toLowerCase().replace(/\s+/g, " ").trim();
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
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

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

  const coreQuestions = intelligence?.core
    ? buildQuestionsFromCore(
        intelligence.core,
        intelligence.ontology ?? [],
        types,
        count,
      )
    : [];

  const sourceQuestions = buildQuestionsFromSource(note.content, count, types);

  let questions = deduplicateQuestions([
    ...coreQuestions,
    ...sourceQuestions,
  ]).slice(0, count);

  questions = validateQuestions(noteId, userId, questions);

  const symbolicCount = questions.length;
  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const missingCount = Math.max(0, count - questions.length);

  if (missingCount > 0) {
    try {
      const sample = sampleDocumentContent(note.content, 20_000);
      const { systemPrompt, prompt } = buildQuizPrompt(sample.text, {
        ...options,
        questionCount: missingCount,
      });

      const aiResult = await generate({
        prompt,
        systemPrompt,
        jsonMode: true,
        temperature: 0.25,
        maxTokens: 3_000,
        usageLabel: "quiz",
        userId,
        noteId
      });

      const parsed = parseQuizResponse(aiResult.text);
      const validAIQuestions = validateQuestions(
        noteId,
        userId,
        parsed.questions,
      );

      questions = deduplicateQuestions([
        ...questions,
        ...validAIQuestions,
      ]).slice(0, count);

      if (validAIQuestions.length > 0) {
        source = symbolicCount > 0 ? "hybrid" : "ai_fallback";
        aiFallbackUsed = true;
        tokensUsed = aiResult.tokensUsed;
      }

      if (parsed.recovered) {
        logger.warn("Recovered valid quiz questions from incomplete AI JSON", {
          noteId,
          recoveredCount: validAIQuestions.length,
        });
      }
    } catch (error) {
      logger.warn("AI quiz fallback unavailable; keeping symbolic questions", {
        noteId,
        requested: count,
        symbolicCount,
        error: error instanceof Error ? error.message : String(error),
      });
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

  const quiz = await quizRepository.create({ noteId, userId, questions });

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
    requested: count,
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

export async function getQuiz(quizId: string): Promise<QuizEntity> {
  const quiz = await quizRepository.findById(quizId);
  if (!quiz) throw new NotFoundError(`Quiz ${quizId} not found`);
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
  const quiz = await quizRepository.findById(quizId);
  if (!quiz || quiz.userId !== userId) {
    throw new ForbiddenError("You do not have access to this quiz.");
  }
  await quizRepository.deleteById(quizId);
}

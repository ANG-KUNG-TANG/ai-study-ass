import { randomUUID } from "crypto";
import * as quizRepo from "@/server/repositories/quiz.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { findKnowledgeObjectByNoteId } from "@/server/repositories/knowledge_object.repo";
import { QuizEntity, type QuizQuestion, type QuestionType } from "@/server/entities/quiz.entity";
import { ForbiddenError, NotFoundError, BadRequestError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { QUIZ_RULES } from "@/server/entities/quiz.entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateQuizOptions {
  count?: number;
  questionType?: QuestionType;
}

// ─── Generate quiz ────────────────────────────────────────────────────────────
// Builds questions from the structured knowledge object.
// Does NOT call the AI API — uses extracted facts directly.

export async function generateQuiz(
  noteId: string,
  userId: string,
  options: GenerateQuizOptions = {}
): Promise<ReturnType<QuizEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const ko = await findKnowledgeObjectByNoteId(noteId);
  if (!ko) throw new BadRequestError("Document has not been processed yet — please wait a moment and try again");

  const count = Math.min(options.count ?? 5, QUIZ_RULES.QUESTIONS_MAX);
  const questionType = options.questionType ?? "multiple_choice";

  const questions = buildQuestionsFromKnowledge(ko.core, count, questionType);

  if (questions.length === 0) {
    throw new BadRequestError("Not enough structured knowledge extracted to generate a quiz — the document may need more content");
  }

  const entity = QuizEntity.create({
    id: randomUUID(),
    noteId,
    userId,
    questions,
  });

  const saved = await quizRepo.create(entity);

  logger.info("Quiz generated from knowledge object", {
    noteId,
    userId,
    questionCount: questions.length,
    questionType,
  });

  return saved.toPublic();
}

// ─── Get quiz by note ─────────────────────────────────────────────────────────

export async function getQuizByNote(
  noteId: string,
  userId: string
): Promise<ReturnType<QuizEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const quiz = await quizRepo.findByNoteId(noteId);
  if (!quiz) throw new NotFoundError("No quiz found for this note — generate one first");

  return quiz.toPublic();
}

// ─── Get quiz by id ───────────────────────────────────────────────────────────

export async function getQuizById(
  quizId: string,
  userId: string
): Promise<ReturnType<QuizEntity["toPublic"]>> {
  const quiz = await quizRepo.findByIdOrThrow(quizId);
  if (!quiz.belongsTo(userId)) throw new ForbiddenError();
  return quiz.toPublic();
}

// ─── Question builder ─────────────────────────────────────────────────────────

function buildQuestionsFromKnowledge(
  core: ReturnType<import("@/server/entities/knowledge_object.entity").KnowledgeObjectEntity["core"]["valueOf"]>,
  count: number,
  questionType: QuestionType
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  // Each fact in KnowledgeCore becomes a candidate question
  const candidates: Array<{ q: string; answer: string; explanation: string }> = [];

  if (core.method) {
    candidates.push({
      q: `What is the main method or algorithm proposed in this document?`,
      answer: core.method,
      explanation: `The document proposes ${core.method} as its primary method.`,
    });
  }

  if (core.dataset) {
    candidates.push({
      q: `Which dataset is used to evaluate the approach in this document?`,
      answer: core.dataset,
      explanation: `The evaluation is performed on the ${core.dataset} dataset.`,
    });
  }

  if (core.accuracy) {
    candidates.push({
      q: `What accuracy or performance score is reported in this document?`,
      answer: core.accuracy,
      explanation: `The document reports a result of ${core.accuracy}.`,
    });
  }

  if (core.metric) {
    candidates.push({
      q: `What evaluation metric is used to measure performance?`,
      answer: core.metric,
      explanation: `${core.metric} is used as the primary evaluation metric.`,
    });
  }

  if (core.topic) {
    candidates.push({
      q: `Which research domain does this document primarily belong to?`,
      answer: core.topic.replace(/_/g, " "),
      explanation: `The document is classified under ${core.topic.replace(/_/g, " ")}.`,
    });
  }

  if (core.problem) {
    candidates.push({
      q: `What problem or challenge does this document address?`,
      answer: core.problem.slice(0, 200),
      explanation: `The document states: "${core.problem.slice(0, 150)}…"`,
    });
  }

  if (core.contribution) {
    candidates.push({
      q: `What is the main contribution of this work?`,
      answer: core.contribution.slice(0, 200),
      explanation: `The authors claim: "${core.contribution.slice(0, 150)}…"`,
    });
  }

  // Add keyword-based questions
  for (const keyword of core.keywords.slice(0, 3)) {
    candidates.push({
      q: `Which of the following is a key concept in this document?`,
      answer: keyword,
      explanation: `"${keyword}" is one of the top-ranked terms in the document.`,
    });
  }

  // Convert candidates → typed questions, up to count
  for (const candidate of candidates.slice(0, count)) {
    if (questionType === "multiple_choice") {
      questions.push(buildMultipleChoice(candidate, core.keywords, core.entities));
    } else if (questionType === "true_false") {
      questions.push(buildTrueFalse(candidate));
    } else {
      questions.push(buildShortAnswer(candidate));
    }
  }

  return questions;
}

// ─── Question type builders ───────────────────────────────────────────────────

function buildMultipleChoice(
  candidate: { q: string; answer: string; explanation: string },
  keywords: string[],
  entities: string[]
): QuizQuestion {
  // Build 3 distractors from keywords and entities that aren't the answer
  const pool = [...keywords, ...entities]
    .filter((k) => k.toLowerCase() !== candidate.answer.toLowerCase())
    .slice(0, 3);

  // Pad with generic distractors if pool is thin
  while (pool.length < 3) pool.push(`Option ${pool.length + 1}`);

  const options = shuffle([candidate.answer, ...pool.slice(0, 3)]);

  return {
    id: randomUUID(),
    question: candidate.q,
    options,
    answer: candidate.answer,
    questionType: "multiple_choice",
    explanation: candidate.explanation,
  };
}

function buildTrueFalse(
  candidate: { q: string; answer: string; explanation: string }
): QuizQuestion {
  return {
    id: randomUUID(),
    question: `True or False: ${candidate.q}`,
    options: ["True", "False"],
    answer: "True", // statement is always true — we generate from known facts
    questionType: "true_false",
    explanation: candidate.explanation,
  };
}

function buildShortAnswer(
  candidate: { q: string; answer: string; explanation: string }
): QuizQuestion {
  return {
    id: randomUUID(),
    question: candidate.q,
    options: [],
    answer: candidate.answer,
    questionType: "short_answer",
    explanation: candidate.explanation,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
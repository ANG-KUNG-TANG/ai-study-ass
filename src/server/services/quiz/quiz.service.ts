// server/services/quiz/quiz.service.ts
// Header now matches actual location (nested under services/quiz/) —
// the flat-vs-nested folder decision is still open, this just stops the
// header comment from lying about where the file actually lives.

import { generate } from '@/server/services/ai.service';
import { buildQuizPrompt, resolveOptions, type QuizPromptOptions } from '@/server/services/quiz/quiz.prompt';
import * as quizRepository from '@/server/repositories/quiz.repo';
import * as noteRepo from '@/server/repositories/note.repo';
import * as intelligenceService from '@/server/services/intelligence.service';
import { QuizEntity, QuizValidationError, QUESTION_TYPES, type QuizQuestionInput } from '@/server/entities/quiz.entity';
import { NotFoundError, ForbiddenError, ValidationError } from '@/server/utils/errors';
import { logger } from '@/server/utils/logger';
import type { KnowledgeCore, ResolvedConcept } from '@/server/intelligence/types';

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
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');

  let parsed: RawQuizJSON;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`quiz.service: AI response was not valid JSON: ${String(err)}`);
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error('quiz.service: AI response missing a "questions" array.');
  }

  return parsed.questions.map((raw, i): QuizQuestionInput => {
    const q = raw as RawQuestionJSON;
    if (typeof q.question !== 'string') {
      throw new Error(`quiz.service: questions[${i}].question must be a string.`);
    }
    if (typeof q.questionType !== 'string' || !QUESTION_TYPES.includes(q.questionType as never)) {
      throw new Error(`quiz.service: questions[${i}].questionType must be one of ${QUESTION_TYPES.join(', ')}.`);
    }
    if (!Array.isArray(q.options) || !q.options.every((o) => typeof o === 'string')) {
      throw new Error(`quiz.service: questions[${i}].options must be a string array.`);
    }
    if (typeof q.answer !== 'string') {
      throw new Error(`quiz.service: questions[${i}].answer must be a string.`);
    }

    return {
      question: q.question,
      questionType: q.questionType as QuizQuestionInput['questionType'],
      options: q.options,
      answer: q.answer,
      explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
    };
  });
}

// ─── Symbolic quiz generation (SYMBOLIC_ONLY / SYMBOLIC_WITH_OPTIONAL_AI_POLISH) ──
// Mirrors flashcard.service.ts's buildCardsFromCore, adapted to Quiz's
// question/options/answer shape instead of front/back.
//
// ASSUMPTION: distractors for multiple_choice are pulled from core.entities
// + ontologyMatches conceptIds, excluding the correct answer. This is a
// simple pool-slice, not a "most plausible wrong answer" ranking — flag if
// you want smarter distractor selection later.
//
// NOT implemented: turning raw PrologFact (functor/args) into a natural-
// language true/false question. Exposing "uses(cnn, imagenet)" verbatim to
// a student reads badly, and doing it properly should route through
// prolog/explanation.ts's human-readable formatting, which I don't have in
// context. Left out rather than shipping a bad-UX placeholder.

function pickDistractors(pool: string[], correct: string, n: number): string[] {
  return pool.filter((d) => d.toLowerCase() !== correct.toLowerCase()).slice(0, n);
}

function buildQuestionsFromCore(
  core: KnowledgeCore,
  ontologyMatches: ResolvedConcept[],
  types: QuizPromptOptions['questionTypes'] & string[],
  count: number,
): QuizQuestionInput[] {
  const questions: QuizQuestionInput[] = [];
  const distractorPool = [...core.entities, ...ontologyMatches.map((m) => m.concept.id)].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  if (core.method && types.includes('multiple_choice')) {
    const distractors = pickDistractors(distractorPool, core.method, 3);
    if (distractors.length >= 1) {
      questions.push({
        question: 'Which method does this paper propose?',
        questionType: 'multiple_choice',
        options: [core.method, ...distractors],
        answer: core.method,
        explanation: `The paper's main method is ${core.method}.`,
      });
    }
  }

  if (core.dataset && types.includes('true_false')) {
    questions.push({
      question: `True or false: this paper evaluates on the ${core.dataset} dataset.`,
      questionType: 'true_false',
      options: ['True', 'False'],
      answer: 'True',
      explanation: `The dataset used is ${core.dataset}.`,
    });
  }

  if (core.problem && types.includes('multiple_choice')) {
    const distractors = pickDistractors(distractorPool, core.problem, 2);
    questions.push({
      question: 'Which problem does this paper primarily address?',
      questionType: 'multiple_choice',
      options: [core.problem.slice(0, 120), ...distractors],
      answer: core.problem.slice(0, 120),
      explanation: 'Drawn directly from the extracted problem statement.',
    });
  }

  if (types.includes('short_answer')) {
    if (core.accuracy !== null) {
      questions.push({
        question: 'What performance result (accuracy) does this paper report?',
        questionType: 'short_answer',
        options: [],
        answer: `${core.accuracy}%`,
        explanation: `Reported accuracy is ${core.accuracy}%.`,
      });
    }
    for (const kp of core.keyPoints.slice(0, Math.max(0, count - questions.length))) {
      questions.push({
        question: `What is stated about "${kp.label}"?`,
        questionType: 'short_answer',
        options: [],
        answer: kp.value.slice(0, 200),
        explanation: `Key point extracted directly from the document.`,
      });
    }
    for (const c of core.contributions.slice(0, Math.max(0, count - questions.length))) {
      questions.push({
        question: 'Name one contribution of this work.',
        questionType: 'short_answer',
        options: [],
        answer: c.slice(0, 200),
        explanation: "One of the paper's stated contributions.",
      });
    }
  }

  return questions.slice(0, count);
}

async function polishQuestionWordingOnly(questions: QuizQuestionInput[]): Promise<QuizQuestionInput[]> {
  return Promise.all(
    questions.map(async (q) => {
      try {
        const result = await generate({
          prompt:
            `Rewrite this quiz question to be clearer without changing its meaning or its answer.\n` +
            `Return ONLY the rewritten question.\n\n${q.question}`,
          temperature: 0.2,
          maxTokens: 100,
        });
        const rewritten = result.text.trim();
        return rewritten ? { ...q, question: rewritten } : q;
      } catch {
        return q;
      }
    }),
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface GenerateQuizOptions extends QuizPromptOptions {
  dropInvalidQuestions?: boolean;
}
// quiz.service.ts — generateQuiz(), corrected section

export async function generateQuiz(
  noteId: string,
  userId: string,
  options: GenerateQuizOptions = {},
): Promise<QuizEntity> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  if (!note.content || note.content.trim().length === 0) {
    throw new ValidationError(`Note ${noteId} has no extracted content to generate a quiz from.`);
  }

  const { count, types } = resolveOptions(options);

  const intelligenceResult = await intelligenceService.getOrRunPipeline(noteId);
  const mode = intelligenceResult.getConfidenceMode();

  let rawQuestions: QuizQuestionInput[] = [];

  if (mode !== 'AI_REQUIRED' && intelligenceResult.core) {
    rawQuestions = buildQuestionsFromCore(intelligenceResult.core, intelligenceResult.ontology ?? [], types, count);
    if (rawQuestions.length > 0 && mode === 'SYMBOLIC_WITH_OPTIONAL_AI_POLISH') {
      rawQuestions = await polishQuestionWordingOnly(rawQuestions);
    }
  }

  if (rawQuestions.length === 0) {
    const { systemPrompt, prompt } = buildQuizPrompt(note.content, options);
    const aiResult = await generate({
      prompt,
      systemPrompt,
      jsonMode: true,
      temperature: 0.5,
      maxTokens: 2048,
    });
    rawQuestions = parseQuizResponse(aiResult.text);
  }

  let questions: QuizQuestionInput[];
  if (options.dropInvalidQuestions) {
    questions = rawQuestions.filter((q) => {
      try {
        // eslint-disable-next-line no-new
        new QuizEntity({ id: 'validation-only', noteId, userId, questions: [q], createdAt: new Date() });
        return true;
      } catch (err) {
        if (err instanceof QuizValidationError) return false;
        throw err;
      }
    });
    if (questions.length === 0) {
      throw new Error('quiz.service: every generated question failed validation — none could be kept.');
    }
  } else {
    questions = rawQuestions;
  }

  logger.info('Quiz generated', { noteId, userId, count: questions.length, mode });
  return quizRepository.create({ noteId, userId, questions });
}

export async function getQuiz(quizId: string): Promise<QuizEntity> {
  const quiz = await quizRepository.findById(quizId);
  if (!quiz) throw new NotFoundError(`Quiz ${quizId} not found`);
  return quiz;
}

export async function getLatestQuizByNote(noteId: string, userId: string): Promise<QuizEntity> {
  const quiz = await quizRepository.findLatestByNote(noteId, userId);
  if (!quiz) throw new NotFoundError(`No quiz has been generated yet for note ${noteId}`);
  return quiz;
}

export async function getAllQuizzesByNote(noteId: string, userId: string): Promise<QuizEntity[]> {
  return quizRepository.findAllByNote(noteId, userId);
}

export async function deleteForNote(noteId: string): Promise<void> {
  await quizRepository.deleteByNoteId(noteId); // was deleteById(noteId) — the cascade no-op bug, fixed
  logger.info('Quiz data deleted', { noteId });
}

export async function getAllQuizzesByUser(userId: string) {
  return quizRepository.findAllByUser(userId);
}

export async function deleteQuiz(quizId: string, userId: string): Promise<void> {
  const quiz = await quizRepository.findById(quizId);
  if (!quiz || quiz.userId !== userId) {
    throw new ForbiddenError('You do not have access to this quiz.');
  }
  await quizRepository.deleteById(quizId);
}
// =============================================================================
// server/entities/quiz.entity.ts
//
// Owns Quiz's business rules. The Mongoose schema (server/models/Quiz.ts)
// imports QUESTION_TYPES from here as the single source of truth for the
// enum, rather than declaring it separately — same "single-source constants"
// principle you use for cookie names and rate-limit keys.
//
// Uses # private fields for true runtime encapsulation (not just a
// TypeScript `private` compile-time annotation) — a QuizEntity instance
// cannot have its internals mutated from outside except through the
// methods this class exposes.
// =============================================================================

export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'short_answer'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const MIN_QUESTIONS_PER_QUIZ = 1;
export const MAX_QUESTIONS_PER_QUIZ = 20;
export const MIN_MULTIPLE_CHOICE_OPTIONS = 2;
export const MAX_MULTIPLE_CHOICE_OPTIONS = 6;

export interface QuizQuestionInput {
  question: string;
  questionType: QuestionType;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizEntityProps {
  id: string;
  noteId: string;
  userId: string;
  questions: QuizQuestionInput[];
  createdAt: Date;
}

/** Thrown when constructing a QuizEntity with data that violates its own rules. */
export class QuizValidationError extends Error {
  constructor(message: string) {
    super(`QuizEntity validation failed: ${message}`);
    this.name = 'QuizValidationError';
  }
}

export class QuizEntity {
  readonly #id: string;
  readonly #noteId: string;
  readonly #userId: string;
  readonly #questions: QuizQuestionInput[];
  readonly #createdAt: Date;

  constructor(props: QuizEntityProps) {
    QuizEntity.#validateQuestions(props.questions);

    this.#id = props.id;
    this.#noteId = props.noteId;
    this.#userId = props.userId;
    // Defensive copy — callers holding a reference to the original array
    // shouldn't be able to mutate this entity's internal state after
    // construction.
    this.#questions = props.questions.map((q) => ({ ...q, options: [...q.options] }));
    this.#createdAt = props.createdAt;
  }

  get id(): string {
    return this.#id;
  }
  get noteId(): string {
    return this.#noteId;
  }
  get userId(): string {
    return this.#userId;
  }
  get questions(): readonly QuizQuestionInput[] {
    return this.#questions;
  }
  get questionCount(): number {
    return this.#questions.length;
  }
  get createdAt(): Date {
    return this.#createdAt;
  }

  /**
   * Checks a submitted answer against the stored correct answer for
   * question at `index`. Case-insensitive, whitespace-trimmed comparison —
   * "Paris " and "paris" should both count as correct for short_answer.
   */
  checkAnswer(index: number, submitted: string): boolean {
    const q = this.#questions[index];
    if (!q) {
      throw new QuizValidationError(`No question at index ${index} (quiz has ${this.#questions.length}).`);
    }
    return q.answer.trim().toLowerCase() === submitted.trim().toLowerCase();
  }

  /** Plain-object projection for API responses / persistence. */
  toJSON() {
    return {
      id: this.#id,
      noteId: this.#noteId,
      userId: this.#userId,
      questions: this.#questions,
      createdAt: this.#createdAt,
    };
  }

  // ── Business rules ──────────────────────────────────────────────────────────

  static #validateQuestions(questions: QuizQuestionInput[]): void {
    if (!Array.isArray(questions) || questions.length < MIN_QUESTIONS_PER_QUIZ) {
      throw new QuizValidationError(`must have at least ${MIN_QUESTIONS_PER_QUIZ} question.`);
    }
    if (questions.length > MAX_QUESTIONS_PER_QUIZ) {
      throw new QuizValidationError(`cannot have more than ${MAX_QUESTIONS_PER_QUIZ} questions.`);
    }

    questions.forEach((q, i) => QuizEntity.#validateQuestion(q, i));
  }

  static #validateQuestion(q: QuizQuestionInput, index: number): void {
    const prefix = `question[${index}]`;

    if (!q.question || q.question.trim().length === 0) {
      throw new QuizValidationError(`${prefix}.question must be a non-empty string.`);
    }
    if (!QUESTION_TYPES.includes(q.questionType)) {
      throw new QuizValidationError(`${prefix}.questionType must be one of ${QUESTION_TYPES.join(', ')}.`);
    }
    if (!q.answer || q.answer.trim().length === 0) {
      throw new QuizValidationError(`${prefix}.answer must be a non-empty string.`);
    }

    switch (q.questionType) {
      case 'multiple_choice':
        if (
          q.options.length < MIN_MULTIPLE_CHOICE_OPTIONS ||
          q.options.length > MAX_MULTIPLE_CHOICE_OPTIONS
        ) {
          throw new QuizValidationError(
            `${prefix}.options must have between ${MIN_MULTIPLE_CHOICE_OPTIONS} and ${MAX_MULTIPLE_CHOICE_OPTIONS} options for a multiple_choice question.`,
          );
        }
        if (!q.options.some((opt) => opt.trim().toLowerCase() === q.answer.trim().toLowerCase())) {
          throw new QuizValidationError(
            `${prefix}.answer ("${q.answer}") must exactly match one of its own options.`,
          );
        }
        break;

      case 'true_false':
        if (!['true', 'false'].includes(q.answer.trim().toLowerCase())) {
          throw new QuizValidationError(`${prefix}.answer must be "True" or "False" for a true_false question.`);
        }
        break;

      case 'short_answer':
        // No options constraint — free text. Nothing further to validate.
        break;
    }
  }
}
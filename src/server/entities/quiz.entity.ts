import { ValidationError } from "@/server/utils/errors";
import { MAX_QUIZ_QUESTIONS } from "@/server/utils/constants";

// ─── Question types ─────────────────────────────────────────────────────────
export const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Reuses the limit already defined in constants.ts rather than redeclaring —
// quiz.prompt.ts imports this under the name MAX_QUESTIONS_PER_QUIZ, so the
// export name stays the same even though the source of truth moved.
export const MAX_QUESTIONS_PER_QUIZ = MAX_QUIZ_QUESTIONS;
export const MIN_QUESTIONS_PER_QUIZ = 1;

// ─── Shapes ──────────────────────────────────────────────────────────────────
export interface QuizQuestionInput {
  question: string;
  questionType: QuestionType;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizQuestionPublic extends QuizQuestionInput {
  id: string;
}

export interface QuizEntityProps {
  id: string;
  noteId: string;
  userId: string;
  questions: QuizQuestionInput[];
  createdAt: Date;
}

export interface QuizPublic {
  id: string;
  noteId: string;
  userId: string;
  questions: QuizQuestionPublic[];
  createdAt: Date;
}

// ─── Error ───────────────────────────────────────────────────────────────────
export class QuizValidationError extends ValidationError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, fields);
    this.name = "QuizValidationError";
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateQuestion(q: QuizQuestionInput, index: number): void {
  if (!q.question || q.question.trim().length === 0) {
    throw new QuizValidationError("Validation failed", {
      [`questions.${index}.question`]: "Question text is required",
    });
  }
  if (!QUESTION_TYPES.includes(q.questionType)) {
    throw new QuizValidationError("Validation failed", {
      [`questions.${index}.questionType`]: `Must be one of ${QUESTION_TYPES.join(", ")}`,
    });
  }
  if (q.questionType === "multiple_choice") {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
      throw new QuizValidationError("Validation failed", {
        [`questions.${index}.options`]: "multiple_choice requires 2-6 options",
      });
    }
    if (!q.options.includes(q.answer)) {
      throw new QuizValidationError("Validation failed", {
        [`questions.${index}.answer`]: "Answer must exactly match one of the options",
      });
    }
  }
  if (q.questionType === "true_false" && q.answer !== "True" && q.answer !== "False") {
    throw new QuizValidationError("Validation failed", {
      [`questions.${index}.answer`]: 'Answer must be exactly "True" or "False"',
    });
  }
  if (q.questionType === "short_answer" && (!q.answer || q.answer.trim().length === 0)) {
    throw new QuizValidationError("Validation failed", {
      [`questions.${index}.answer`]: "Answer is required",
    });
  }
}

// ─── Entity ──────────────────────────────────────────────────────────────────
// Public constructor (not a private-constructor + static create() split like
// NoteEntity/UserEntity) — quiz.service.ts's dropInvalidQuestions path calls
// `new QuizEntity(...)` directly per-question as a validation probe, so the
// constructor itself has to be the validation gate. Confirmed against the
// real quiz.service.ts — this call site exists exactly as assumed.
export class QuizEntity {
  #id: string;
  #noteId: string;
  #userId: string;
  #questions: QuizQuestionInput[];
  #createdAt: Date;

  constructor(props: QuizEntityProps) {
    if (!Array.isArray(props.questions) || props.questions.length < MIN_QUESTIONS_PER_QUIZ) {
      throw new QuizValidationError("Validation failed", {
        questions: `Quiz must have at least ${MIN_QUESTIONS_PER_QUIZ} question(s)`,
      });
    }
    if (props.questions.length > MAX_QUESTIONS_PER_QUIZ) {
      throw new QuizValidationError("Validation failed", {
        questions: `Quiz cannot exceed ${MAX_QUESTIONS_PER_QUIZ} questions`,
      });
    }
    props.questions.forEach(validateQuestion);

    this.#id = props.id;
    this.#noteId = props.noteId;
    this.#userId = props.userId;
    this.#questions = props.questions;
    this.#createdAt = props.createdAt;
  }

  get id(): string { return this.#id; }
  get noteId(): string { return this.#noteId; }
  get userId(): string { return this.#userId; }
  get questions(): QuizQuestionInput[] { return this.#questions; }
  get createdAt(): Date { return this.#createdAt; }

  // Synthesizes a stable per-question id (`${quizId}-q${index}`) since raw
  // AI/symbolic output has no id concept — needed for React keys and for
  // tracking "which question is the student currently on" client-side.
  toJSON(): QuizPublic {
    return {
      id: this.#id,
      noteId: this.#noteId,
      userId: this.#userId,
      questions: this.#questions.map((q, i) => ({ id: `${this.#id}-q${i}`, ...q })),
      createdAt: this.#createdAt,
    };
  }
}
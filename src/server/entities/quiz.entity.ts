import { ValidationError } from "@/server/utils/errors";

// ─── Rules ────────────────────────────────────────────────────────────────────

export const QUIZ_RULES = {
  questions: { min: 1, max: 20 },
  options: { min: 2, max: 6 },    // per question
} as const;

export type QuizId = string;
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type DifficultyLevel = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options: string[];          // empty for short_answer
  correctAnswer: string;
  explanation: string | null;
}

export interface QuizProps {
  id: QuizId;
  noteId: string;
  userId: string;
  questions: QuizQuestion[];
  difficulty: DifficultyLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizPublic extends QuizProps {}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateQuestions(questions: QuizQuestion[]): void {
  if (questions.length < QUIZ_RULES.questions.min) {
    throw new ValidationError("Validation failed", {
      questions: `Quiz must have at least ${QUIZ_RULES.questions.min} question`,
    });
  }
  if (questions.length > QUIZ_RULES.questions.max) {
    throw new ValidationError("Validation failed", {
      questions: `Quiz cannot exceed ${QUIZ_RULES.questions.max} questions`,
    });
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class QuizEntity {
  readonly #id: QuizId;
  readonly #noteId: string;
  readonly #userId: string;
  readonly #questions: QuizQuestion[];
  readonly #difficulty: DifficultyLevel;
  readonly #createdAt: Date;
  readonly #updatedAt: Date;

  private constructor(props: QuizProps) {
    this.#id = props.id;
    this.#noteId = props.noteId;
    this.#userId = props.userId;
    this.#questions = props.questions;
    this.#difficulty = props.difficulty;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
  }

  get id(): QuizId { return this.#id; }
  get noteId(): string { return this.#noteId; }
  get userId(): string { return this.#userId; }
  get questions(): QuizQuestion[] { return this.#questions; }
  get difficulty(): DifficultyLevel { return this.#difficulty; }
  get createdAt(): Date { return this.#createdAt; }
  get updatedAt(): Date { return this.#updatedAt; }

  static create(input: {
    id: QuizId;
    noteId: string;
    userId: string;
    questions: QuizQuestion[];
    difficulty: DifficultyLevel;
  }): QuizEntity {
    validateQuestions(input.questions);
    return new QuizEntity({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: QuizProps): QuizEntity {
    return new QuizEntity(props);
  }

  belongsTo(userId: string): boolean {
    return this.#userId === userId;
  }

  questionCount(): number {
    return this.#questions.length;
  }

  toPublic(): QuizPublic {
    return {
      id: this.#id,
      noteId: this.#noteId,
      userId: this.#userId,
      questions: this.#questions,
      difficulty: this.#difficulty,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  toPersistence(): QuizProps {
    return this.toPublic();
  }
}
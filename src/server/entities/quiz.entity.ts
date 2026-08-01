import { ValidationError } from "@/server/utils/errors";
import { MAX_QUIZ_QUESTIONS } from "@/server/utils/constants";

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "short_answer",
] as const;

export type QuestionType =
  (typeof QUESTION_TYPES)[number];

export const MAX_QUESTIONS_PER_QUIZ =
  MAX_QUIZ_QUESTIONS;

export const MIN_QUESTIONS_PER_QUIZ = 1;

export interface QuizQuestionInput {
  question: string;
  questionType: QuestionType;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizQuestionPublic
  extends QuizQuestionInput {
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
  createdAt: string;
}

export class QuizValidationError
  extends ValidationError {
  constructor(
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message, fields);
    this.name = "QuizValidationError";
  }
}

function validateQuestion(
  question: QuizQuestionInput,
  index: number,
): void {
  if (!question.question?.trim()) {
    throw new QuizValidationError(
      "Validation failed",
      {
        [`questions.${index}.question`]:
          "Question text is required",
      },
    );
  }

  if (
    !QUESTION_TYPES.includes(
      question.questionType,
    )
  ) {
    throw new QuizValidationError(
      "Validation failed",
      {
        [`questions.${index}.questionType`]:
          `Must be one of ${QUESTION_TYPES.join(", ")}`,
      },
    );
  }

  if (
    !Array.isArray(question.options)
  ) {
    throw new QuizValidationError(
      "Validation failed",
      {
        [`questions.${index}.options`]:
          "Options must be an array",
      },
    );
  }

  if (
    question.questionType ===
    "multiple_choice"
  ) {
    if (
      question.options.length < 2 ||
      question.options.length > 6
    ) {
      throw new QuizValidationError(
        "Validation failed",
        {
          [`questions.${index}.options`]:
            "multiple_choice requires 2-6 options",
        },
      );
    }

    if (
      !question.options.includes(
        question.answer,
      )
    ) {
      throw new QuizValidationError(
        "Validation failed",
        {
          [`questions.${index}.answer`]:
            "Answer must exactly match one option",
        },
      );
    }
  }

  if (
    question.questionType === "true_false"
  ) {
    if (
      question.answer !== "True" &&
      question.answer !== "False"
    ) {
      throw new QuizValidationError(
        "Validation failed",
        {
          [`questions.${index}.answer`]:
            'Answer must be exactly "True" or "False"',
        },
      );
    }
  }

  if (
    question.questionType ===
      "short_answer" &&
    !question.answer?.trim()
  ) {
    throw new QuizValidationError(
      "Validation failed",
      {
        [`questions.${index}.answer`]:
          "Answer is required",
      },
    );
  }
}

export class QuizEntity {
  readonly #id: string;
  readonly #noteId: string;
  readonly #userId: string;
  readonly #questions: QuizQuestionInput[];
  readonly #createdAt: Date;

  constructor(props: QuizEntityProps) {
    if (
      !Array.isArray(props.questions) ||
      props.questions.length <
        MIN_QUESTIONS_PER_QUIZ
    ) {
      throw new QuizValidationError(
        "Validation failed",
        {
          questions:
            `Quiz must have at least ` +
            `${MIN_QUESTIONS_PER_QUIZ} question(s)`,
        },
      );
    }

    if (
      props.questions.length >
      MAX_QUESTIONS_PER_QUIZ
    ) {
      throw new QuizValidationError(
        "Validation failed",
        {
          questions:
            `Quiz cannot exceed ` +
            `${MAX_QUESTIONS_PER_QUIZ} questions`,
        },
      );
    }

    props.questions.forEach(
      validateQuestion,
    );

    this.#id = props.id;
    this.#noteId = props.noteId;
    this.#userId = props.userId;
    this.#questions =
      props.questions.map((question) => ({
        ...question,
        options: [...question.options],
      }));
    this.#createdAt = new Date(
      props.createdAt,
    );
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

  get questions(): QuizQuestionInput[] {
    return this.#questions.map(
      (question) => ({
        ...question,
        options: [...question.options],
      }),
    );
  }

  get createdAt(): Date {
    return new Date(this.#createdAt);
  }

  toJSON(): QuizPublic {
    return {
      id: this.#id,
      noteId: this.#noteId,
      userId: this.#userId,

      // QuizQuestionInput has no id. Public ids are generated here so
      // React receives stable keys without storing redundant ids in MongoDB.
      questions: this.#questions.map(
        (question, index) => ({
          id: `${this.#id}-q${index}`,
          question: question.question,
          questionType:
            question.questionType,
          options: [...question.options],
          answer: question.answer,
          explanation:
            question.explanation,
        }),
      ),

      createdAt:
        this.#createdAt.toISOString(),
    };
  }
}

import { apiFetch } from "@/lib/api";
import type {
  Quiz,
  GenerateQuizOptions,
} from "@/types/quiz";

type QuizQuestion =
  Quiz["questions"][number];

type QuizRequestOptions =
  GenerateQuizOptions & {
    force?: boolean;
  };

const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "short_answer",
] as const;

type QuestionType =
  (typeof QUESTION_TYPES)[number];

function asRecord(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(
  value: unknown,
): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string",
      )
    : [];
}

function resolveQuestionType(
  raw: Record<string, unknown>,
  options: string[],
): QuestionType {
  const candidate =
    raw.questionType ??
    raw.type ??
    raw.question_type;

  if (
    typeof candidate === "string" &&
    QUESTION_TYPES.includes(
      candidate as QuestionType,
    )
  ) {
    return candidate as QuestionType;
  }

  const lower =
    options.map((option) =>
      option.toLowerCase(),
    );

  if (
    options.length === 2 &&
    lower.includes("true") &&
    lower.includes("false")
  ) {
    return "true_false";
  }

  return options.length >= 2
    ? "multiple_choice"
    : "short_answer";
}

function normalizeQuestion(
  value: unknown,
  index: number,
  quizId: string,
): QuizQuestion {
  const raw = asRecord(value);
  const options = stringArray(
    raw.options,
  );
  const questionType =
    resolveQuestionType(
      raw,
      options,
    );

  return {
    id:
      typeof raw.id === "string"
        ? raw.id
        : `${quizId}-q${index}`,

    question:
      typeof raw.question === "string"
        ? raw.question
        : `Question ${index + 1}`,

    questionType,

    options:
      questionType === "true_false"
        ? ["True", "False"]
        : options,

    answer:
      typeof raw.answer === "string"
        ? raw.answer
        : "",

    explanation:
      typeof raw.explanation === "string"
        ? raw.explanation
        : undefined,
  } as QuizQuestion;
}

function normalizeQuiz(
  value: unknown,
): Quiz {
  const raw = asRecord(value);

  const id =
    typeof raw.id === "string"
      ? raw.id
      : "";

  return {
    id,

    noteId:
      typeof raw.noteId === "string"
        ? raw.noteId
        : "",

    userId:
      typeof raw.userId === "string"
        ? raw.userId
        : "",

    questions:
      Array.isArray(raw.questions)
        ? raw.questions.map(
            (question, index) =>
              normalizeQuestion(
                question,
                index,
                id,
              ),
          )
        : [],

    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
  } as Quiz;
}

export async function generateQuiz(
  noteId: string,
  options: QuizRequestOptions = {},
): Promise<Quiz> {
  const result =
    await apiFetch<unknown>(
      "/quiz/generate",
      {
        method: "POST",
        body: JSON.stringify({
          noteId,
          ...options,
        }),
      },
    );

  return normalizeQuiz(result);
}

export async function listQuizzesByNote(
  noteId: string,
): Promise<Quiz[]> {
  const result =
    await apiFetch<unknown>(
      `/quiz/note/${encodeURIComponent(noteId)}`,
    );

  return Array.isArray(result)
    ? result.map(normalizeQuiz)
    : [];
}

export function deleteQuiz(
  id: string,
): Promise<void> {
  return apiFetch<void>(
    `/quiz/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

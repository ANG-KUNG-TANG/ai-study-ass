import {
  Quiz,
  type QuizDocument,
} from "@/server/models/Quiz";
import {
  QuizEntity,
  QUESTION_TYPES,
  type QuestionType,
  type QuizQuestionInput,
} from "@/server/entities/quiz.entity";

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

  const normalizedOptions =
    options.map((option) =>
      option.toLowerCase(),
    );

  if (
    options.length === 2 &&
    normalizedOptions.includes("true") &&
    normalizedOptions.includes("false")
  ) {
    return "true_false";
  }

  if (options.length >= 2) {
    return "multiple_choice";
  }

  return "short_answer";
}

function normalizeAnswer(
  rawAnswer: unknown,
  type: QuestionType,
  options: string[],
): string {
  const answer =
    typeof rawAnswer === "string"
      ? rawAnswer.trim()
      : "";

  if (type === "true_false") {
    if (answer.toLowerCase() === "true") {
      return "True";
    }

    if (answer.toLowerCase() === "false") {
      return "False";
    }

    return "True";
  }

  if (type === "multiple_choice") {
    const exact = options.find(
      (option) =>
        option.toLowerCase() ===
        answer.toLowerCase(),
    );

    return exact ?? options[0] ?? "";
  }

  return answer;
}

function normalizeQuestion(
  value: unknown,
  index: number,
): QuizQuestionInput {
  const raw =
    value &&
    typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const options = stringArray(raw.options);
  const questionType =
    resolveQuestionType(raw, options);

  return {
    question:
      typeof raw.question === "string" &&
      raw.question.trim()
        ? raw.question.trim()
        : `Question ${index + 1}`,

    questionType,

    options:
      questionType === "true_false"
        ? ["True", "False"]
        : options,

    answer: normalizeAnswer(
      raw.answer,
      questionType,
      questionType === "true_false"
        ? ["True", "False"]
        : options,
    ),

    explanation:
      typeof raw.explanation === "string"
        ? raw.explanation.trim()
        : undefined,
  };
}

function toEntity(
  doc: QuizDocument,
): QuizEntity {
  return new QuizEntity({
    id: doc._id.toString(),
    noteId: String(doc.noteId),
    userId: String(doc.userId),

    // Normalize legacy records that used `type`, `question_type`, or omitted
    // questionType. This prevents old MongoDB data from crashing the UI.
    questions: (
      doc.questions as unknown[]
    ).map(normalizeQuestion),

    createdAt: doc.createdAt,
  });
}

export async function create(params: {
  noteId: string;
  userId: string;
  questions: QuizQuestionInput[];
}): Promise<QuizEntity> {
  // Validate before persistence.
  new QuizEntity({
    id: "validation-only",
    noteId: params.noteId,
    userId: params.userId,
    questions: params.questions,
    createdAt: new Date(),
  });

  const doc = await Quiz.create({
    noteId: params.noteId,
    userId: params.userId,
    questions: params.questions,
  });

  return toEntity(doc);
}

export async function findById(
  id: string,
): Promise<QuizEntity | null> {
  const doc = await Quiz.findById(id);
  return doc ? toEntity(doc) : null;
}

export async function findAllByNote(
  noteId: string,
  userId: string,
): Promise<QuizEntity[]> {
  const docs = await Quiz.find({
    noteId,
    userId,
  }).sort({
    createdAt: -1,
  });

  return docs.map(toEntity);
}

export async function findLatestByNote(
  noteId: string,
  userId: string,
): Promise<QuizEntity | null> {
  const doc = await Quiz.findOne({
    noteId,
    userId,
  }).sort({
    createdAt: -1,
  });

  return doc ? toEntity(doc) : null;
}

export async function count(): Promise<number> {
  return Quiz.countDocuments();
}

export async function deleteById(
  id: string,
): Promise<boolean> {
  const result =
    await Quiz.findByIdAndDelete(id);

  return result !== null;
}

export async function deleteByNoteId(
  noteId: string,
): Promise<number> {
  const result = await Quiz.deleteMany({
    noteId,
  });

  return result.deletedCount ?? 0;
}

export async function findAllByUser(
  userId: string,
): Promise<QuizEntity[]> {
  const docs = await Quiz.find({
    userId,
  }).sort({
    createdAt: -1,
  });

  return docs.map(toEntity);
}

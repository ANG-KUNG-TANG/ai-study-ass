import {
  QUESTION_TYPES,
  MIN_QUESTIONS_PER_QUIZ,
  MAX_QUESTIONS_PER_QUIZ,
  type QuestionType,
} from "@/server/entities/quiz.entity";
import { DEFAULT_QUIZ_QUESTIONS } from "@/server/utils/constants";

const MAX_CONTENT_CHARS = 24_000;
const DEFAULT_QUESTION_TYPES: QuestionType[] = [
  "multiple_choice",
  "true_false",
];

export interface QuizPromptOptions {
  questionCount?: number;
  questionTypes?: QuestionType[];
}

export interface QuizPromptResult {
  systemPrompt: string;
  prompt: string;
  wasTruncated: boolean;
  resolvedCount: number;
  resolvedTypes: QuestionType[];
}

export function resolveOptions(options: QuizPromptOptions): {
  count: number;
  types: QuestionType[];
} {
  const requestedCount = options.questionCount ?? DEFAULT_QUIZ_QUESTIONS;
  const count = Math.min(
    Math.max(requestedCount, MIN_QUESTIONS_PER_QUIZ),
    MAX_QUESTIONS_PER_QUIZ,
  );

  const requestedTypes = options.questionTypes?.filter((type) =>
    QUESTION_TYPES.includes(type),
  );
  const types =
    requestedTypes && requestedTypes.length > 0
      ? requestedTypes
      : DEFAULT_QUESTION_TYPES;

  return { count, types };
}

export function buildQuizPrompt(
  noteContent: string,
  options: QuizPromptOptions = {},
): QuizPromptResult {
  const { count, types } = resolveOptions(options);
  const wasTruncated = noteContent.length > MAX_CONTENT_CHARS;
  const content = wasTruncated
    ? noteContent.slice(0, MAX_CONTENT_CHARS)
    : noteContent;

  const systemPrompt = `You are a study assistant that writes quiz questions from supplied study material.
Respond with ONLY one valid JSON object — no markdown fences or prose.
The object must contain one key, "questions".
Aim for ${count} questions, but return fewer if the material cannot support ${count} distinct, factual questions. Never invent content merely to reach the requested count.
Each question object must contain:
- "question": clear question text
- "questionType": one of ${types.map((type) => `"${type}"`).join(", ")}
- "options": 2-6 strings for multiple_choice, ["True","False"] for true_false, [] for short_answer
- "answer": exact correct answer; for multiple_choice it must exactly match one option
- "explanation": one concise evidence-grounded sentence
Avoid duplicates. Mix difficulty and concepts. Use only facts supported by the material.`;

  const prompt = `Write up to ${count} high-quality quiz questions from this study material.${
    wasTruncated
      ? " The supplied material was already bounded for context size."
      : ""
  }

--- MATERIAL START ---
${content}
--- MATERIAL END ---`;

  return {
    systemPrompt,
    prompt,
    wasTruncated,
    resolvedCount: count,
    resolvedTypes: types,
  };
}

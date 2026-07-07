// =============================================================================
// server/services/quiz.prompt.ts
//
// Builds the prompt for quiz generation. Separate from quiz.service.ts so
// the prompt text can be iterated on independently of the parsing/
// persistence logic around it — same split as summary.prompt.ts.
// =============================================================================

import {
  QUESTION_TYPES,
  MIN_QUESTIONS_PER_QUIZ,
  MAX_QUESTIONS_PER_QUIZ,
  type QuestionType,
} from '@/server/entities/quiz.entity';

const MAX_CONTENT_CHARS = 24_000; // same reasoning as summary.prompt.ts

const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_QUESTION_TYPES: QuestionType[] = ['multiple_choice', 'true_false'];

export interface QuizPromptOptions {
  questionCount?: number;
  questionTypes?: QuestionType[];
}

export interface QuizPromptResult {
  systemPrompt: string;
  prompt: string;
  wasTruncated: boolean;
  /** The resolved (validated/clamped) options actually used to build the prompt. */
  resolvedCount: number;
  resolvedTypes: QuestionType[];
}

/**
 * Clamps a requested question count into the valid range and validates
 * requested types against the known QUESTION_TYPES enum, falling back to
 * defaults for anything invalid rather than throwing — a caller passing
 * questionCount: 500 should get a smaller quiz, not a 500-error.
 */
export function resolveOptions(options: QuizPromptOptions): { count: number; types: QuestionType[] } {
  const requestedCount = options.questionCount ?? DEFAULT_QUESTION_COUNT;
  const count = Math.min(Math.max(requestedCount, MIN_QUESTIONS_PER_QUIZ), MAX_QUESTIONS_PER_QUIZ);

  const requestedTypes = options.questionTypes?.filter((t) => QUESTION_TYPES.includes(t));
  const types = requestedTypes && requestedTypes.length > 0 ? requestedTypes : DEFAULT_QUESTION_TYPES;

  return { count, types };
}

export function buildQuizPrompt(noteContent: string, options: QuizPromptOptions = {}): QuizPromptResult {
  const { count, types } = resolveOptions(options);
  const wasTruncated = noteContent.length > MAX_CONTENT_CHARS;
  const content = wasTruncated ? noteContent.slice(0, MAX_CONTENT_CHARS) : noteContent;

  const systemPrompt = `You are a study assistant that writes quiz questions from study material.
Respond with ONLY a single valid JSON object — no markdown fences, no prose before or after it.
The JSON object must have exactly one key, "questions", an array of exactly ${count} question objects.
Each question object must have exactly these keys:
  "question": the question text.
  "questionType": one of ${types.map((t) => `"${t}"`).join(', ')}.
  "options": for "multiple_choice", an array of 2-6 plausible answer strings (including the correct one).
             for "true_false", the array ["True", "False"].
             for "short_answer", an empty array [].
  "answer": the exact correct answer. For multiple_choice, it must exactly match one of "options".
            For true_false, it must be exactly "True" or "False".
  "explanation": one sentence explaining why the answer is correct.
Only use question types from this list: ${types.join(', ')}. Base every question strictly on the material below — do not invent facts not present in it.`;

  const prompt = `Write a ${count}-question quiz for the following study material.${
    wasTruncated ? ' (Note: this material was truncated to fit length limits — write questions from what is shown.)' : ''
  }

--- MATERIAL START ---
${content}
--- MATERIAL END ---`;

  return { systemPrompt, prompt, wasTruncated, resolvedCount: count, resolvedTypes: types };
}
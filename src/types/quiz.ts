export const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface QuizQuestion {
  id: string;
  question: string;
  questionType: QuestionType;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface Quiz {
  id: string;
  noteId: string;
  userId: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface GenerateQuizOptions {
  questionCount?: number;
  questionTypes?: QuestionType[];
  dropInvalidQuestions?: boolean;
  force?: boolean;
}
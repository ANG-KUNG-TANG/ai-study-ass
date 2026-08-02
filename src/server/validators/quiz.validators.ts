import { z } from "zod";
import {
  MAX_QUESTIONS_PER_QUIZ,
  MIN_QUESTIONS_PER_QUIZ,
  QUESTION_TYPES,
} from "@/server/entities/quiz.entity";

export const generateQuizSchema = z.object({
  noteId: z.string().min(1, "noteId is required"),
  questionCount: z
    .number()
    .int()
    .min(MIN_QUESTIONS_PER_QUIZ)
    .max(MAX_QUESTIONS_PER_QUIZ)
    .optional(),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).optional(),
  dropInvalidQuestions: z.boolean().optional(),
  force: z.boolean().optional(),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;

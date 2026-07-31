// server/validators/chat.validator.ts
import { z } from "zod";

export const askQuestionSchema = z.object({
  question: z
    .string({ error: "question is required" })
    .trim()
    .min(1, "question cannot be empty")
    .max(2000, "question is too long"),
});

export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
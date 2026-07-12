// server/controllers/chat.controller.ts
//
// POST   /api/notes/[id]/chat    ask a question about a note
// GET    /api/notes/[id]/chat    get chat history for a note
// DELETE /api/notes/[id]/chat    clear chat history for a note

import type { NextResponse } from "next/server";
import { z } from "zod";
import { successResponse, createdResponse, noContentResponse } from "@/server/utils/response";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";
import * as chatService from "@/server/services/chat.service";
import { ValidationError } from "@/server/utils/errors";
import { CHAT_RULES } from "@/server/entities/chat.entity";

const askBodySchema = z.object({
  question: z.string().min(CHAT_RULES.question.minLength).max(CHAT_RULES.question.maxLength),
});

export async function askQuestion(
  req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("Validation failed", {
      body: "Request body must be valid JSON",
    });
  }

  const { question } = askBodySchema.parse(json);

  const result = await chatService.askQuestion(noteId, auth.userId, question);
  return createdResponse(result);
}

export async function getChatHistory(
  _req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;
  const history = await chatService.getChatHistory(noteId, auth.userId);
  return successResponse(history);
}

export async function clearChatHistory(
  _req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;
  await chatService.clearChatHistory(noteId, auth.userId);
  return noContentResponse();
}
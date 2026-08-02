import type { NextResponse } from "next/server";
import { z } from "zod";
import {
  createdResponse,
  noContentResponse,
  successResponse,
} from "@/server/utils/response";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as chatService from "@/server/services/chat/chat.service";
import { BadRequestError, ValidationError } from "@/server/utils/errors";
import { CHAT_RULES } from "@/server/entities/chat.entity";

const askBodySchema = z.object({
  question: z
    .string()
    .trim()
    .min(CHAT_RULES.question.minLength)
    .max(CHAT_RULES.question.maxLength),
});

async function getNoteId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const noteId = params.id ?? params.noteId ?? params.noteid;

  if (!noteId) {
    throw new BadRequestError("Missing note id in route parameters");
  }

  return noteId;
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("Validation failed", {
      body: "Request body must be valid JSON",
    });
  }
}

export async function askQuestion(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getNoteId(context);
  const { question } = askBodySchema.parse(await readJsonBody(req));
  const result = await chatService.askQuestion(noteId, auth.userId, question);

  return createdResponse(result);
}

export async function getChatHistory(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getNoteId(context);
  const history = await chatService.getChatHistory(noteId, auth.userId);

  return successResponse(history);
}

export async function clearChatHistory(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getNoteId(context);
  await chatService.clearChatHistory(noteId, auth.userId);
  return noContentResponse();
}

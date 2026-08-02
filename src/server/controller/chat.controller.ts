<<<<<<< HEAD
import type {
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";
=======
import type { NextResponse } from "next/server";
import { z } from "zod";
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
import {
  successResponse,
  createdResponse,
  noContentResponse,
} from "@/server/utils/response";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as chatService from "@/server/services/chat/chat.service";
<<<<<<< HEAD
import {
  BadRequestError,
  ValidationError,
} from "@/server/utils/errors";
import {
  CHAT_RULES,
} from "@/server/entities/chat.entity";

const askBodySchema =
  z.object({
    question:
      z.string()
        .trim()
        .min(
          CHAT_RULES.question.minLength,
        )
        .max(
          CHAT_RULES.question.maxLength,
        ),
  });

async function getNoteId(
  context: RouteContext,
): Promise<string> {
  const params =
    await context.params;

  const noteId =
    params.id ??
    params.noteId ??
    params.noteid;

  if (!noteId) {
    throw new BadRequestError(
      "Missing note id in route parameters",
    );
  }

  return noteId;
}
=======
import { BadRequestError, ValidationError } from "@/server/utils/errors";
import { CHAT_RULES } from "@/server/entities/chat.entity";

const askBodySchema = z.object({
  question: z
    .string()
    .trim()
    .min(CHAT_RULES.question.minLength)
    .max(CHAT_RULES.question.maxLength),
});
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)

async function getNoteId(context: RouteContext): Promise<string> {
  const params = await context.params;

  const noteId = params.id ?? params.noteId ?? params.noteid;

  if (!noteId) {
    throw new BadRequestError("Missing note id in route parameters");
  }

  return noteId;
}

export async function askQuestion(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
<<<<<<< HEAD
  const noteId =
    await getNoteId(
      context,
    );
=======
  const noteId = await getNoteId(context);
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)

  let json: unknown;

  try {
    json =
      await req.json();
  } catch {
    throw new ValidationError(
      "Validation failed",
      {
        body:
          "Request body must be valid JSON",
      },
    );
  }

  const {
    question,
  } =
    askBodySchema.parse(
      json,
    );

<<<<<<< HEAD
  const result =
    await chatService
      .askQuestion(
        noteId,
        auth.userId,
        question,
      );

  return createdResponse(
    result,
  );
=======
  const result = await chatService.askQuestion(noteId, auth.userId, question);

  return createdResponse(result);
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
}

export async function getChatHistory(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
<<<<<<< HEAD
  const noteId =
    await getNoteId(
      context,
    );

  const history =
    await chatService
      .getChatHistory(
        noteId,
        auth.userId,
      );

  return successResponse(
    history,
  );
=======
  const noteId = await getNoteId(context);

  const history = await chatService.getChatHistory(noteId, auth.userId);

  return successResponse(history);
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
}

export async function clearChatHistory(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
<<<<<<< HEAD
  const noteId =
    await getNoteId(
      context,
    );

  await chatService
    .clearChatHistory(
      noteId,
      auth.userId,
    );
=======
  const noteId = await getNoteId(context);

  await chatService.clearChatHistory(noteId, auth.userId);
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)

  return noContentResponse();
}

<<<<<<< HEAD
import type {
  NextResponse,
} from "next/server";
import { z } from "zod";
import {
  successResponse,
  createdResponse,
} from "@/server/utils/response";
=======
import type { NextResponse } from "next/server";
import { z } from "zod";
import { successResponse, createdResponse } from "@/server/utils/response";
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as flashcardService from "@/server/services/flashcard.service";
<<<<<<< HEAD
import {
  BadRequestError,
  ValidationError,
} from "@/server/utils/errors";
import {
  FLASHCARD_RULES,
} from "@/server/entities/flashcard.entity";
import {
  logActivity,
} from "@/server/services/auditLog.service";
=======
import { BadRequestError, ValidationError } from "@/server/utils/errors";
import { FLASHCARD_RULES } from "@/server/entities/flashcard.entity";
import { logActivity } from "@/server/services/auditLog.service";
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)

const generateBodySchema = z.object({
  count: z
    .number()
    .int()
    .min(
      FLASHCARD_RULES.count.min,
    )
    .max(
      FLASHCARD_RULES.count.max,
    )
    .optional(),

  force: z
    .boolean()
    .optional(),

  force: z.boolean().optional(),
});

const reviewBodySchema = z.object({
  difficulty: z.enum([
    "easy",
    "medium",
    "hard",
  ]),
});

<<<<<<< HEAD
async function getId(
  context: RouteContext,
): Promise<string> {
  const params =
    await context.params;

  const id =
    params.id ??
    params.noteId ??
    params.noteid;

  if (!id) {
    throw new BadRequestError(
      "Missing route id",
    );
=======
async function getId(context: RouteContext): Promise<string> {
  const params = await context.params;

  const id = params.id ?? params.noteId ?? params.noteid;

  if (!id) {
    throw new BadRequestError("Missing route id");
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
  }

  return id;
}

export async function generateFlashcards(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
<<<<<<< HEAD
  const noteId =
    await getId(context);

  let json: unknown = {};

  const rawText =
    await req.text();
=======
  const noteId = await getId(context);

  let json: unknown = {};

  const rawText = await req.text();
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)

  if (rawText.trim()) {
    try {
      json =
        JSON.parse(rawText);
    } catch {
<<<<<<< HEAD
      throw new ValidationError(
        "Validation failed",
        {
          body:
            "Request body must be valid JSON",
        },
      );
    }
  }

  const {
    count,
    force,
  } =
    generateBodySchema.parse(
      json,
    );

  const result =
    await flashcardService
      .generateFlashcardsWithMetadata(
        noteId,
        auth.userId,
        count,
        { force },
      );

  void logActivity({
    actorId:
      auth.userId,
    actorEmail:
      auth.email,
    action:
      "flashcards.generated",
    targetType:
      "note",
    targetId:
      noteId,
    metadata: {
      cardCount:
        result.flashcards.length,
      source:
        result.metadata.source,
      forced:
        force ?? false,
=======
      throw new ValidationError("Validation failed", {
        body: "Request body must be valid JSON",
      });
    }
  }

  const { count, force } = generateBodySchema.parse(json);

  const result = await flashcardService.generateFlashcardsWithMetadata(
    noteId,
    auth.userId,
    count,
    { force },
  );

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "flashcards.generated",
    targetType: "note",
    targetId: noteId,
    metadata: {
      cardCount: result.flashcards.length,
      source: result.metadata.source,
      forced: force ?? false,
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
    },
  });

  return createdResponse(
    result.flashcards,
    "Flashcards generated successfully",
  );
}

export async function listFlashcards(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
<<<<<<< HEAD
  const noteId =
    await getId(context);

  const flashcards =
    await flashcardService
      .getFlashcardsByNote(
        noteId,
        auth.userId,
      );

  return successResponse(
    flashcards,
  );
=======
  const noteId = await getId(context);

  const flashcards = await flashcardService.getFlashcardsByNote(
    noteId,
    auth.userId,
  );

  return successResponse(flashcards);
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
}

export async function updateFlashcardReview(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
<<<<<<< HEAD
  const flashcardId =
    await getId(context);
=======
  const flashcardId = await getId(context);
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
    difficulty,
  } =
    reviewBodySchema.parse(
      json,
    );

<<<<<<< HEAD
  const updated =
    await flashcardService
      .updateReview(
        flashcardId,
        auth.userId,
        difficulty,
      );

  return successResponse(
    updated,
  );
=======
  const updated = await flashcardService.updateReview(
    flashcardId,
    auth.userId,
    difficulty,
  );

  return successResponse(updated);
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
}

import type { NextResponse } from "next/server";
import { z } from "zod";
import { createdResponse, successResponse } from "@/server/utils/response";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as flashcardService from "@/server/services/flashcard.service";
import { BadRequestError, ValidationError } from "@/server/utils/errors";
import { FLASHCARD_RULES } from "@/server/entities/flashcard.entity";
import { logActivity } from "@/server/services/auditLog.service";

const generateBodySchema = z.object({
  count: z
    .number()
    .int()
    .min(FLASHCARD_RULES.count.min)
    .max(FLASHCARD_RULES.count.max)
    .optional(),
  force: z.boolean().optional(),
});

const reviewBodySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

async function getId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params.id ?? params.noteId ?? params.noteid;

  if (!id) {
    throw new BadRequestError("Missing route id");
  }

  return id;
}

async function readOptionalJsonBody(req: Request): Promise<unknown> {
  const rawText = await req.text();

  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new ValidationError("Validation failed", {
      body: "Request body must be valid JSON",
    });
  }
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

export async function generateFlashcards(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getId(context);
  const { count, force } = generateBodySchema.parse(
    await readOptionalJsonBody(req),
  );

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
  const noteId = await getId(context);
  const flashcards = await flashcardService.getFlashcardsByNote(
    noteId,
    auth.userId,
  );

  return successResponse(flashcards);
}

export async function updateFlashcardReview(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const flashcardId = await getId(context);
  const { difficulty } = reviewBodySchema.parse(await readJsonBody(req));
  const updated = await flashcardService.updateReview(
    flashcardId,
    auth.userId,
    difficulty,
  );

  return successResponse(updated);
}

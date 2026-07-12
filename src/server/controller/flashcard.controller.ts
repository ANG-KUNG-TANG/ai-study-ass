// server/controllers/flashcard.controller.ts
//
// Three endpoints:
//   POST   /api/notes/[id]/flashcards        generate flashcards for a note
//   GET    /api/notes/[id]/flashcards        list flashcards for a note
//   PATCH  /api/flashcards/[id]/review        record a review + difficulty
//
// Ownership checks (note.belongsTo / flashcard.belongsTo) live in
// flashcard.service.ts, not here — matches the pattern used by quiz/chat
// services, not the ownership-in-controller pattern summary.controller.ts
// used. Consistent with the rest of the codebase's services.

import type { NextResponse } from "next/server";
import { z } from "zod";
import { successResponse, createdResponse } from "@/server/utils/response";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";
import * as flashcardService from "@/server/services/flashcard.service";
import { ValidationError } from "@/server/utils/errors";
import { FLASHCARD_RULES } from "@/server/entities/flashcard.entity";

const generateBodySchema = z.object({
  count: z
    .number()
    .int()
    .min(FLASHCARD_RULES.count.min)
    .max(FLASHCARD_RULES.count.max)
    .optional(),
});

const reviewBodySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

// ─── POST /api/notes/[id]/flashcards ──────────────────────────────────────────
// Body is optional — { "count": 15 } or no body at all (service defaults to 10).
export async function generateFlashcards(
  req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;

  // count is optional, so an empty body is valid here — don't call req.json()
  // directly on a possibly-empty body (see summary.controller.ts's 422 fix).
  let json: unknown = {};
  const rawText = await req.text();
  if (rawText.trim().length > 0) {
    try {
      json = JSON.parse(rawText);
    } catch {
      throw new ValidationError("Validation failed", {
        body: "Request body must be valid JSON",
      });
    }
  }

  const { count } = generateBodySchema.parse(json);

  const flashcards = await flashcardService.generateFlashcards(noteId, auth.userId, count);
  return createdResponse(flashcards, "Flashcards generated successfully");
}

// ─── GET /api/notes/[id]/flashcards ───────────────────────────────────────────
export async function listFlashcards(
  _req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;
  const flashcards = await flashcardService.getFlashcardsByNote(noteId, auth.userId);
  return successResponse(flashcards);
}

// ─── PATCH /api/flashcards/[id]/review ────────────────────────────────────────
export async function updateFlashcardReview(
  req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: flashcardId } = await context.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("Validation failed", {
      body: "Request body must be valid JSON",
    });
  }

  const { difficulty } = reviewBodySchema.parse(json);

  const updated = await flashcardService.updateReview(flashcardId, auth.userId, difficulty);
  return successResponse(updated);
}
// =============================================================================
// server/controllers/quiz.controller.ts
//
// Controller layer, same role as your existing auth/user/admin controllers:
// parse+validate the request, enforce ownership, call the service, shape the
// response. Routes (src/app/api/quiz/**/route.ts) stay thin — they just wrap
// a controller function with withAuth from auth.middleware.ts and export it
// as the HTTP verb, e.g.:
//
//   export const POST = withAuth(generateQuizController);
//   export const GET  = withAuth(getQuizController);
//
// withAuth already does its own try/catch -> handleError(err), so there's no
// separate withErrorHandler wrapper needed.
// =============================================================================

import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { AuthContext } from '@/server/middleware/auth.middleware'; // adjust path if this lives elsewhere
import { successResponse, createdResponse, noContentResponse } from '@/server/utils/response';
import { deleteQuiz, generateQuiz, getAllQuizzesByNote, getAllQuizzesByUser } from '@/server/services/quiz/quiz.service';
import { findById as findQuizById } from '@/server/repositories/quiz.repo';
import { findById as findNoteById } from '@/server/repositories/note.repo';
import { QUESTION_TYPES } from '../entities/quiz.entity';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { isValidObjectId } from 'mongoose';

// Matches RouteContext in auth.middleware.ts: params is a Promise (Next.js 15
// async params), not a plain object.
type RouteContext = { params: Promise<Record<string, string>> };

const generateBodySchema = z.object({
  noteId: z.string().min(1),
  questionCount: z.number().int().positive().optional(),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).optional(),
  dropInvalidQuestions: z.boolean().optional(),
});

/**
 * Confirms the requesting user owns the note before any quiz operation
 * touches it. Both controller actions below need this same check, so it's
 * factored out rather than duplicated — quiz.service.ts deliberately
 * doesn't know about users/ownership (see its own header comment), so
 * this is the one place that responsibility lives.
 */
async function assertOwnsNote(noteId: string, userId: string): Promise<void> {
  const note = await findNoteById(noteId);
  // Deliberately the same error for "doesn't exist" and "exists but isn't
  // yours" — a caller shouldn't be able to distinguish the two and use
  // that to enumerate valid noteIds belonging to other users.
  if (!note || String(note.userId) !== userId) {
    throw new ForbiddenError('You do not have access to this note.');
  }
}

/**
 * POST /api/quiz/generate
 * Body: { noteId, questionCount?, questionTypes?, dropInvalidQuestions? }
 */
export async function generateQuizController(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const json = await req.json();
  const { noteId, questionCount, questionTypes, dropInvalidQuestions } =
    generateBodySchema.parse(json);

  await assertOwnsNote(noteId, auth.userId);

  const quiz = await generateQuiz(noteId, auth.userId, {
    questionCount,
    questionTypes,
    dropInvalidQuestions,
  });

  return createdResponse(quiz.toJSON());
}

/**
 * GET /api/quiz/[id]
 */
export async function getQuizController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    throw new NotFoundError('Quiz');
  }

  const quiz = await findQuizById(id);
  if (!quiz || quiz.userId !== auth.userId) {
    throw new ForbiddenError('You do not have access to this quiz.');
  }
  return successResponse(quiz.toJSON());
}

/**
 * GET /api/quiz/note/[noteId]  — list every quiz generated from a note,
 * most recent first (a note can have several, per quiz.repository.ts's
 * findAllByNote — each generate call creates a new one).
 */
export async function listQuizzesByNoteController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { noteId } = await context.params;
  await assertOwnsNote(noteId, auth.userId);
  const quizzes = await getAllQuizzesByNote(noteId, auth.userId);
  return successResponse(quizzes.map((q: any) => q.toJSON()));
}

/**
 * GET /api/quiz — every quiz belonging to the authenticated user,
 * across all notes, most recent first.
 */
export async function listAllQuizzesController(
  _req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const quizzes = await getAllQuizzesByUser(auth.userId);
  return successResponse(quizzes.map((q) => q.toJSON()));
}

/**
 * DELETE /api/quiz/[id]
 */
export async function deleteQuizController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  await deleteQuiz(id, auth.userId);
  return noContentResponse();
}


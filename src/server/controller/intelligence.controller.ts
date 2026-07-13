import type { NextResponse } from "next/server";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as noteRepo from "@/server/repositories/note.repo";
import { ForbiddenError } from "@/server/utils/errors";
import { successResponse } from "@/server/utils/response";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";

// ─── Purpose ────────────────────────────────────────────────────────────────
// HTTP-facing layer for read-only intelligence status. Intelligence has no
// userId of its own — ownership is enforced by loading the parent Note and
// checking note.belongsTo(userId), the same pattern note.service.ts already
// uses for getNoteById/deleteNote. This controller does NOT expose a way to
// trigger a pipeline run directly; that only happens implicitly through
// note upload or a feature request (quiz/flashcard/chat/summary), by
// design — status-checking should never have the side effect of starting
// an expensive pipeline run.

export async function getIntelligenceStatus(
  _req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;

  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(auth.userId)) throw new ForbiddenError();

  const status = await intelligenceService.getStatus(noteId);
  return successResponse(status);
}
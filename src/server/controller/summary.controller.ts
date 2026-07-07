// server/controllers/summary.controller.ts
//
// Matches auth.middleware.ts's real AuthedHandler contract:
//   (req: Request, context: { params: Promise<Record<string,string>> }, auth: AuthContext)
// The uploaded route.ts handler used (req, { userId }) — two args, with the
// second treated as the auth object directly. That doesn't match withAuth's
// actual call signature `handler(req, context, auth)`, so `userId` would
// have been undefined at runtime (destructured off `context`, which has no
// userId field). Fixed here by taking all three params and reading
// `auth.userId` explicitly.
//
// Ownership check lives here (not in summary.service.ts) — summary.service
// is intentionally note-agnostic-of-ownership per its own docstring, same
// division of responsibility the original route.ts used. Note this is
// inconsistent with quiz/flashcard/chat services, which each do their own
// `note.belongsTo(userId)` check internally. Worth standardizing one way or
// the other — flagging rather than silently picking one here.

import { z } from "zod";
import type { AuthContext } from "@/server/middleware/auth.middleware";
import { successResponse } from "@/server/utils/response";
import { generateSummary } from "@/server/services/summiary/summary.service";
import { findById as findNoteById } from "@/server/repositories/note.repo";
import { ForbiddenError } from "@/server/utils/errors";

const bodySchema = z.object({
  noteId: z.string().min(1),
  force: z.boolean().optional(),
});

type RouteContext = { params: Promise<Record<string, string>> };

export async function postSummary(
  req: Request,
  _context: RouteContext,
  auth: AuthContext
) {
  const json = await req.json();
  const { noteId, force } = bodySchema.parse(json);

  const note = await findNoteById(noteId);
  if (note && String(note.userId) !== auth.userId) {
    throw new ForbiddenError("You do not have access to this note.");
  }

  const result = await generateSummary(noteId, { force });

  return successResponse(result);
}
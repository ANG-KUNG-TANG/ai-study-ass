import { z } from "zod";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import { successResponse } from "@/server/utils/response";
import { generateSummary } from "@/server/services/summary/summary.service";
import { findById as findNoteById } from "@/server/repositories/note.repo";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/utils/errors";
import { logActivity } from "@/server/services/auditLog.service";

const bodySchema = z.object({
  noteId: z.string().min(1),
  force: z.boolean().optional(),
});

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("Validation failed", {
      body: "Request body must be valid JSON",
    });
  }
}

export async function postSummary(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
) {
  const { noteId, force } = bodySchema.parse(await readJsonBody(req));
  const note = await findNoteById(noteId);

  if (!note) {
    throw new NotFoundError(`Note ${noteId}`);
  }

  if (!note.belongsTo(auth.userId)) {
    throw new ForbiddenError("You do not have access to this note.");
  }

  const result = await generateSummary(noteId, { force });

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "summary.generated",
    targetType: "note",
    targetId: noteId,
    metadata: {
      source: result.source,
      status: result.status,
      forced: force ?? false,
    },
  });

  return successResponse(result);
}

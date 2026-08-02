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

export async function postSummary(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
) {
  let json: unknown;

  try {
    json = await req.json();
  } catch {
<<<<<<< HEAD
    throw new ValidationError(
      "Validation failed",
      {
        body:
          "Request body must be valid JSON",
      },
    );
=======
    throw new ValidationError("Validation failed", {
      body: "Request body must be valid JSON",
    });
  }

  const { noteId, force } = bodySchema.parse(json);

  const note = await findNoteById(noteId);

  if (!note) {
    throw new NotFoundError(`Note ${noteId} not found`);
  }

  if (!note.belongsTo(auth.userId)) {
    throw new ForbiddenError("You do not have access to this note.");
>>>>>>> 0340f1e (refactor(server): update feature controllers, repos, and entities for chat, quiz, and flashcards)
  }

  const { noteId, force } =
    bodySchema.parse(json);

  const note = await findNoteById(noteId);

  if (!note) {
    throw new NotFoundError(
      `Note ${noteId} not found`,
    );
  }

  if (!note.belongsTo(auth.userId)) {
    throw new ForbiddenError(
      "You do not have access to this note.",
    );
  }

  const result = await generateSummary(
    noteId,
    { force },
  );

  logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "summary.generated",
    targetType: "note",
    targetId: noteId,
  });

  return successResponse(result);
}

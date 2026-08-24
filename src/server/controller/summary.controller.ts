import { z } from "zod";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import { successResponse } from "@/server/utils/response";
import { generateSummary } from "@/server/services/summary/summary.service";
import { findByIdAndUserId as findNoteByIdAndUserId } from "@/server/repositories/note.repo";
import {
  NotFoundError,
  ValidationError,
} from "@/server/utils/errors";
import { logActivity } from "@/server/services/auditLog.service";
import { SUMMARY_MODES } from "@/types/summary";

const bodySchema = z.object({
  noteId: z.string().min(1),
  force: z.boolean().optional(),
  mode: z.enum(SUMMARY_MODES).optional(),
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
  const { noteId, force, mode } = bodySchema.parse(await readJsonBody(req));
  const note = await findNoteByIdAndUserId(
    noteId,
    auth.userId,
  );

  if (!note) {
    throw new NotFoundError("Note");
  }

  const result = await generateSummary(noteId, { force, mode });

  await logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "summary.generated",
    targetType: "note",
    targetId: noteId,
    metadata: {
      source: result.source,
      status: result.status,
      forced: force ?? false,
      mode: result.mode,
    },
  });

  return successResponse(result);
}

import type { NextResponse } from "next/server";
import { connectDb } from "@/server/config/database";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { createdResponse } from "@/server/utils/response";
import {
  extractFileFromRequest,
  processUpload,
} from "@/server/services/upload.service";
import { createNote } from "@/server/services/note.service";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import { logActivity } from "@/server/services/auditLog.service";

// POST /api/upload
export async function uploadNoteController(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  await authLimiter(
    req,
    `upload:${auth.userId}`,
  );

  await connectDb();

  const file =
    await extractFileFromRequest(req);

  const processed =
    await processUpload(file);

  const note = await createNote(
    auth.userId,
    processed,
  );

  await logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "note.uploaded",
    targetType: "note",
    targetId: note.id,
    metadata: {
      title: note.title,
    },
  });

  return createdResponse(
    note,
    "Note created successfully",
  );
}

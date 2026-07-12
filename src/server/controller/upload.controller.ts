import type { NextResponse } from "next/server";
import { connectDb } from "@/server/config/database";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { createdResponse } from "@/server/utils/response";
import { extractFileFromRequest, processUpload } from "@/server/services/upload.service";
import { createNote } from "@/server/services/note.service";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";

// POST /api/upload
// NOTE: authLimiter(req) is called without `await` here, matching the
// original route.ts. If authLimiter is async internally, add `await` —
// otherwise a rejection here becomes an unhandled promise rejection
// instead of an error response.
export async function uploadNoteController(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  authLimiter(req);
  await connectDb();

  const file = await extractFileFromRequest(req);
  const processed = await processUpload(file);
  const note = await createNote(auth.userId, processed);

  return createdResponse(note, "Note created successfully");
}
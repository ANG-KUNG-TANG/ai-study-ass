import type { NextResponse } from "next/server";

import { connectDb } from "@/server/config/database";

import { authLimiter } from "@/server/middleware/rate_limiter.middleware";

import { createdResponse } from "@/server/utils/response";

import { extractFileFromRequest } from "@/server/services/upload.service";

import { ingestDocument } from "@/server/services/document-ingestion.service";

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
  authLimiter(req, `upload:${auth.userId}`);

  await connectDb();

  const file = await extractFileFromRequest(req);

  const result = await ingestDocument(auth.userId, file);

  void logActivity({
    actorId: auth.userId,

    actorEmail: auth.email,

    action: "note.uploaded",

    targetType: "note",

    targetId: result.note.id,

    metadata: {
      title: result.note.title,

      backgroundProcessing: result.backgroundProcessing,

      pageCount: result.pageCount,

      extractionQuality: result.extractionQuality,
    },
  });

  return createdResponse(
    {
      ...result.note,

      processing: {
        background: result.backgroundProcessing,

        stage: result.backgroundProcessing ? "vision_ocr" : "pending",
      },
    },

    result.backgroundProcessing
      ? "Note created. PDF processing will continue in the background."
      : "Note created successfully.",
  );
}

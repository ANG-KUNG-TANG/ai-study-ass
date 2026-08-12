import type { NextResponse } from "next/server";

import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";

import { retryFailedPdfIngestion } from "@/server/services/pdf-ingestion-retry.service";

import { successResponse } from "@/server/utils/response";

export async function retryPdfIngestionController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id: noteId } = await context.params;

  const result = await retryFailedPdfIngestion(noteId, auth.userId);

  return successResponse(result);
}

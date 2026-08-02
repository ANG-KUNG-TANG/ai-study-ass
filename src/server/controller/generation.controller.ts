import { NextResponse } from "next/server";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as generationService from "@/server/services/study-material-generation.service";
import { successResponse } from "@/server/utils/response";

export async function getGenerationStatusController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
) {
  const { id: noteId } = await context.params;
  const status = await generationService.getGenerationStatus(
    noteId,
    auth.userId,
  );

  return successResponse(status);
}

export async function regenerateStudyMaterialsController(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
) {
  const { id: noteId } = await context.params;

  let force = true;

  try {
    const body = (await req.json()) as {
      force?: boolean;
    };
    force = body.force ?? true;
  } catch {
    // Request body is optional.
  }

  await generationService.getGenerationStatus(noteId, auth.userId);

  generationService.generateStudyMaterialsInBackground({
    noteId,
    userId: auth.userId,
    force,
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        noteId,
        stage: "pending",
        message: "Study material regeneration has started.",
      },
    },
    { status: 202 },
  );
}

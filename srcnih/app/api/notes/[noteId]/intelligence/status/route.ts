import { NextResponse } from "next/server";
import * as intelligenceService from "@/server/services/intelligence.service";

/**
 * Apply the same authentication/ownership wrapper used by your other note
 * routes. The response contains processing metadata only, but note access
 * should still be restricted to the note owner.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ noteId: string }> },
) {
  const { noteId } = await context.params;
  const status = await intelligenceService.getStatus(noteId);

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

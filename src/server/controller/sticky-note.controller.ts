import type { NextResponse } from "next/server";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import {
  createdResponse,
  noContentResponse,
  successResponse,
} from "@/server/utils/response";
import * as stickyNoteService from "@/server/services/sticky-note.service";
import {
  parseCreateStickyNote,
  parseStickyNoteQuery,
} from "@/server/validators/sticky-note.validators";

export async function listStickyNotes(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { limit } = parseStickyNoteQuery(req);
  const notes = await stickyNoteService.listStickyNotes(auth.userId, limit);
  return successResponse(notes);
}

export async function createStickyNote(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const input = await parseCreateStickyNote(req);
  const note = await stickyNoteService.createStickyNote(auth.userId, input);
  return createdResponse(note, "Quick note saved");
}

export async function deleteStickyNote(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  await stickyNoteService.deleteStickyNote(id, auth.userId);
  return noContentResponse();
}

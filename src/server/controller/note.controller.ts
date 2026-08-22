import type { NextResponse } from "next/server";
import * as noteService from "@/server/services/note.service";
import { successResponse, noContentResponse, paginatedResponse } from "@/server/utils/response";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";
import { parseNoteQuery } from "@/server/validators/note.validators";
import { logActivity } from "@/server/services/auditLog.service";

// GET /api/notes
export async function listNotes(
  req: Request,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  // parseNoteQuery now validates via Zod (server/validators/note.validators.ts)
  // instead of doing unchecked Number()/type-cast coercion here. A bad param
  // (e.g. ?page=abc, ?limit=1000, ?fileType=xyz) throws a ZodError immediately,
  // which your error-handler middleware maps to a 422 with the offending field
  // named — instead of silently becoming NaN/an unvalidated string and failing
  // three layers down in note.repo.ts with an opaque error.
  const options = parseNoteQuery(req);
  const normalizedOptions = {
    ...options,
    sortBy: options.sortBy === "fileSize" ? undefined : options.sortBy,
  };
  const result = await noteService.listNotes(auth.userId, normalizedOptions);
  return paginatedResponse(result.data, result.meta);
}

// GET /api/notes/[id]
export async function getNoteById(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const note = await noteService.getNoteById(id, auth.userId);
  return successResponse(note);
}

// DELETE /api/notes/[id]
export async function deleteNote(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const note = await noteService.getNoteById(id, auth.userId); // fetch before delete for title/metadata
  await noteService.deleteNote(id, auth.userId);
  await logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "note.deleted",
    targetType: "note",
    targetId: id,
    metadata: { title: note.title },
  });
  return noContentResponse();
}
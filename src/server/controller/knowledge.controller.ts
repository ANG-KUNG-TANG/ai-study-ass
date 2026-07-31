// server/knowledge/knowledge.controller.ts

import type { NextResponse } from 'next/server';
import * as knowledgeService from '@/server/services/knowledge.service';
import * as noteRepo from '@/server/repositories/note.repo';
import { ForbiddenError } from '@/server/utils/errors';
import { successResponse } from '@/server/utils/response';
import type { AuthContext, RouteContext } from '@/server/middleware/auth.middleware';

// ─── Purpose ────────────────────────────────────────────────────────────────
// Knowledge has no userId of its own — ownership is enforced here by loading
// the parent Note and checking note.belongsTo(auth.userId), same pattern as
// intelligence.controller.ts. Not delegated to the caller: this controller
// may end up reachable from more than one route in future, and "the caller
// already checked" is exactly the kind of assumption that quietly breaks.

// server/knowledge/knowledge.controller.ts — param destructuring updated
export async function getKnowledgeByNote(
  _req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;   // was: const { noteId } = ...

  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(auth.userId)) throw new ForbiddenError();

  const knowledge = await knowledgeService.getKnowledge(noteId);
  return successResponse(knowledge);
}

export async function deleteKnowledgeByNote(
  _req: Request,
  context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const { id: noteId } = await context.params;   // was: const { noteId } = ...

  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(auth.userId)) throw new ForbiddenError();

  const deleted = await knowledgeService.deleteKnowledge(noteId);
  return successResponse({ deleted });
}
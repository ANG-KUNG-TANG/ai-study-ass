// server/knowledge/knowledge.controller.ts

import type { NextRequest, NextResponse } from 'next/server';
import * as knowledgeService from '@/server/services/knowledge.service';
import { successResponse } from '@/server/utils/response'; // ASSUMPTION: confirm path
import { withErrorHandler } from '@/server/middleware/error.middleware'; // ASSUMPTION: confirm path
import type { AuthContext } from '@/server/middleware/auth.middleware'; // ASSUMPTION: confirm 3-arg shape

// No ownership check here — assuming the caller (note.service) already
// verified the note belongs to this user before Knowledge is touched.
// Flag if that's wrong; see note above.

type KnowledgeContext = AuthContext & { params: { noteId: string } };

export async function getKnowledgeByNote(
  _req: NextRequest,
  context: KnowledgeContext,
  _auth: { userId: string }
): Promise<NextResponse> {
  const { noteId } = context.params;
  const knowledge = await knowledgeService.getKnowledge(noteId);
  return successResponse(knowledge);
}

export async function deleteKnowledgeByNote(
  _req: NextRequest,
  context: KnowledgeContext,
  _auth: { userId: string }
): Promise<NextResponse> {
  const { noteId } = context.params;
  const deleted = await knowledgeService.deleteKnowledge(noteId);
  return successResponse({ deleted });
}

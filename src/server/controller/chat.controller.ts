import type { NextResponse } from "next/server";
import { z } from "zod";
import * as chatService from "@/server/services/chat/chat.service";
import { successResponse, createdResponse, noContentResponse } from "@/server/utils/response";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";

const sendMessageBodySchema = z.object({
  question: z.string().min(1),
});

// POST /api/notes/[noteId]/chat
// Ownership is enforced inside chatService.sendMessage itself
// (note.belongsTo(userId) -> ForbiddenError), so no separate check here.
export async function sendMessageController(
  req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { noteId } = await context.params;
  const { question } = sendMessageBodySchema.parse(await req.json());

  const message = await chatService.sendMessage(noteId, auth.userId, question);
  return createdResponse(message);
}

// GET /api/notes/[noteId]/chat
export async function getChatHistoryController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { noteId } = await context.params;
  const history = await chatService.getChatHistory(noteId, auth.userId);
  return successResponse(history);
}

// DELETE /api/notes/[noteId]/chat
export async function clearChatHistoryController(
  _req: Request,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {``
  const { noteId } = await context.params;
  await chatService.clearHistory(noteId, auth.userId);
  return noContentResponse();
}
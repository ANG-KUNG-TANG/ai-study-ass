// app/api/notes/[noteId]/chat/route.ts
import { withAuth } from "@/server/middleware/auth.middleware";
import {
  sendMessageController,
  getChatHistoryController,
  clearChatHistoryController,
} from "@/server/controller/chat.controller";

export const POST = withAuth(sendMessageController);
export const GET = withAuth(getChatHistoryController);
export const DELETE = withAuth(clearChatHistoryController);
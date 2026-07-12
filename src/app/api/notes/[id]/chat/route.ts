import { withAuth } from "@/server/middleware/auth.middleware";
import { askQuestion, getChatHistory, clearChatHistory } from "@/server/controller/chat.controller";

export const POST = withAuth(askQuestion);
export const GET = withAuth(getChatHistory);
export const DELETE = withAuth(clearChatHistory);
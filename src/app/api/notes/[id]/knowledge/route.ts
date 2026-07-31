import { withAuth } from "@/server/middleware/auth.middleware";
import { getKnowledgeByNote, deleteKnowledgeByNote } from "@/server/controller/knowledge.controller";

export const GET = withAuth(getKnowledgeByNote);
export const DELETE = withAuth(deleteKnowledgeByNote);
// app/api/notes/[id]/route.ts
import { withAuth } from "@/server/middleware/auth.middleware";
import { getNoteById, deleteNote } from "@/server/controller/note.controller";

export const GET = withAuth(getNoteById);
export const DELETE = withAuth(deleteNote);
// app/api/notes/route.ts
import { withAuth } from "@/server/middleware/auth.middleware";
import { listNotes } from "@/server/controller/note.controller";

export const GET = withAuth(listNotes);
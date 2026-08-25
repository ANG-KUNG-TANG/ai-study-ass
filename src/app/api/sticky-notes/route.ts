import { withAuth } from "@/server/middleware/auth.middleware";
import {
  createStickyNote,
  listStickyNotes,
} from "@/server/controller/sticky-note.controller";

export const GET = withAuth(listStickyNotes);
export const POST = withAuth(createStickyNote);

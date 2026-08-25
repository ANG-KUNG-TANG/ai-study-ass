import { withAuth } from "@/server/middleware/auth.middleware";
import { deleteStickyNote } from "@/server/controller/sticky-note.controller";

export const DELETE = withAuth(deleteStickyNote);

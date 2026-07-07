import { withAuth } from "@/server/middleware/auth.middleware";
import { uploadNoteController } from "@/server/controller/upload.controller";

export const POST = withAuth(uploadNoteController);
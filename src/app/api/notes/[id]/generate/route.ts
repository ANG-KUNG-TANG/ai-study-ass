import { withAuth } from "@/server/middleware/auth.middleware";
import { regenerateStudyMaterialsController } from "@/server/controller/generation.controller";

export const POST = withAuth(
  regenerateStudyMaterialsController,
);

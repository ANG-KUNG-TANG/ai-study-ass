import { withAuth } from "@/server/middleware/auth.middleware";
import { getGenerationStatusController } from "@/server/controller/generation.controller";

export const GET = withAuth(
  getGenerationStatusController,
);

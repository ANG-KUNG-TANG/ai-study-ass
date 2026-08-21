import { withAuth } from "@/server/middleware/auth.middleware";
import { aiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { regenerateStudyMaterialsController } from "@/server/controller/generation.controller";

export const POST = withAuth(async (req, context, auth) => {
  await aiLimiter(req, `study-generation:${auth.userId}`);
  return regenerateStudyMaterialsController(req, context, auth);
});

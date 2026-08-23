import { withAuth } from "@/server/middleware/auth.middleware";
import { getIntelligenceStatus } from "@/server/controller/intelligence.controller";

// Legacy alias for /api/notes/[id]/intelligence.
// Authentication and note ownership are enforced by the shared controller.
export const GET = withAuth(getIntelligenceStatus);

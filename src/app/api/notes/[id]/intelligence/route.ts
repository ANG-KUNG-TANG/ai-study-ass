// app/api/notes/[id]/intelligence/route.ts
import { withAuth } from "@/server/middleware/auth.middleware";
import { getIntelligenceStatus } from "@/server/controller/intelligence.controller";

export const GET = withAuth(getIntelligenceStatus);
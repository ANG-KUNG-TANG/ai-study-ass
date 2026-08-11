import type { NextRequest } from "next/server";
import { withAuth } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getMe } from "@/server/controller/auth.controller";

// GET /api/auth/me
export const GET = withAuth(async (req, context, auth) => {
  await apiLimiter(req, 'me');
  return getMe(req as NextRequest, context, auth);
});
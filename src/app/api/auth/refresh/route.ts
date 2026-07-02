import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { refresh } from "@/server/controller/auth.controller";

// POST /api/auth/refresh
// Public (identity comes from the refresh-token cookie, not a Bearer token).
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  return refresh(req as NextRequest);
});
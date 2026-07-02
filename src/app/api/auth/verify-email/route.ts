import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { verifyEmail } from "@/server/controller/auth.controller";

// POST /api/auth/verify-email
// Public.
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  return verifyEmail(req as NextRequest);
});
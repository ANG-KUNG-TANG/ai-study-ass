import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { verifyEmail } from "@/server/controller/auth.controller";

// POST /api/auth/verify-email
// Public.
export const POST = withErrorHandler(async (req) => {
  await authLimiter(req, 'verify-email');
  return verifyEmail(req as NextRequest);
});
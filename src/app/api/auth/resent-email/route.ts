import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { resendVerification } from "@/server/controller/auth.controller";

// POST /api/auth/resend-verification
// Public. Rate-limited to discourage email-bombing a target address.
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  return resendVerification(req as NextRequest);
});
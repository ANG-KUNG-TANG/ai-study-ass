import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { resetPassword } from "@/server/controller/auth.controller";

// POST /api/auth/reset-password
// Public — identity comes from the reset token in the body, not a session.
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  return resetPassword(req as NextRequest);
});
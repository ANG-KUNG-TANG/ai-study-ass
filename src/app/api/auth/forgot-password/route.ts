import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { forgotPassword } from "@/server/controller/auth.controller";

// POST /api/auth/forgot-password
// Public. Brute-force/spam protected via authLimiter (10 req/15min per IP).
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  return forgotPassword(req as NextRequest);
});
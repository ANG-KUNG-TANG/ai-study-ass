import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { login } from "@/server/controller/auth.controller";

// POST /api/auth/login
// Public. authLimiter is the brute-force guard here.
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  return login(req as NextRequest);
});
import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { register } from "@/server/controller/auth.controller";

// POST /api/auth/register
// Public. Brute-force/spam protected via authLimiter (10 req/15min per IP).
export const POST = withErrorHandler(async (req) => {
  authLimiter(req);
  // NOTE: cast is a stopgap — withErrorHandler types `req` as bare `Request`,
  // controller expects `NextRequest`. See flag #3.
  return register(req as NextRequest);
});
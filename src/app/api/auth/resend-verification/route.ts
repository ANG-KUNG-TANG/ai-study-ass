import type { NextRequest } from "next/server";

import { resendVerification } from "@/server/controller/auth.controller";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";

// Public. Rate-limited to discourage email-bombing a target address.
export const POST = withErrorHandler(async (req) => {
  await authLimiter(req, "resend-verification");
  return resendVerification(req as NextRequest);
});

import type { NextRequest } from "next/server";
import { testAIProvider } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const POST = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:ai-provider:test`);
  return testAIProvider(req as NextRequest, { params: Promise.resolve({}) }, auth);
});

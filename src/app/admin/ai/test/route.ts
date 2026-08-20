import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { testAIProvider } from "@/server/controller/admin.controller";

// POST /api/admin/ai/test
export const POST = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, "admin:ai-test");

  return testAIProvider(
    req as NextRequest,
    {
      params: Promise.resolve({} as Record<string, string>),
    },
    auth,
  );
});

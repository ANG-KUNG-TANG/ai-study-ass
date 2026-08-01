import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getRecentActivity } from "@/server/controller/admin.controller";

// GET /api/admin/activity
export const GET = withRole("admin")(async (req, _context, auth) => {
  apiLimiter(req, "admin:activity");
  return getRecentActivity(
    req as NextRequest,
    { params: Promise.resolve({} as Record<string, string>) },
    auth,
  );
});
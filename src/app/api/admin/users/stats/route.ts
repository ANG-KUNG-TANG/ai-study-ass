import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getUserStats } from "@/server/controller/admin.controller";

// GET /api/admin/users/stats
export const GET = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, "admin:user-stats");
  return getUserStats(
    req as NextRequest,
    { params: Promise.resolve({} as Record<string, string>) },
    auth,
  );
});
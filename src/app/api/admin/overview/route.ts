// src/app/api/admin/overview/route.ts
import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getOverviewStats } from "@/server/controller/admin.controller";

// GET /api/admin/overview
export const GET = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, 'admin:overview');
  return getOverviewStats(
    req as NextRequest,
    { params: Promise.resolve({} as Record<string, string>) },
    auth,
  );
});


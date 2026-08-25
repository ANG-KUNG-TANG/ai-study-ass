import type { NextRequest } from "next/server";
import { exportActivity } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:activity:export`);
  return exportActivity(req as NextRequest, { params: Promise.resolve({}) }, auth);
});

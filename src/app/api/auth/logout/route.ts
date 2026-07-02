import type { NextRequest } from "next/server";
import { withAuth } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { logout } from "@/server/controller/auth.controller";

// POST /api/auth/logout
export const POST = withAuth(async (req, _context, auth) => {
  apiLimiter(req);
  return logout(req as NextRequest, auth);
});
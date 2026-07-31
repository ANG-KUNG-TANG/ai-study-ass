import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { listContent } from "@/server/controller/admin.controller";

// GET /api/admin/content
export const GET = withRole("admin")(async (req, _context, auth) => {
  apiLimiter(req, "admin:list-content");
  return listContent(req as NextRequest, auth);
});
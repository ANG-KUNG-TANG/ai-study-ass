import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { listUsers } from "@/server/controller/admin.controller";

// GET /api/admin/users
export const GET = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, "admin:list-users");
  return listUsers(
    req as NextRequest,
    { params: Promise.resolve({} as Record<string, string>) },
    auth,
  );
});
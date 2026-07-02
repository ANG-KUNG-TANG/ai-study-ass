import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { unbanUser } from "@/server/controller/admin.controller";

// POST /api/admin/users/[id]/unban
export const POST = withRole("admin")(async (req, context, auth) => {
  apiLimiter(req);
  const params = await context.params;
  return unbanUser(req as NextRequest, auth, { params: params as { id: string } });
});
import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { updateUserRole } from "@/server/controller/admin.controller";

// PATCH /api/admin/users/[id]/role
export const PATCH = withRole("admin")(async (req, context, auth) => {
  apiLimiter(req);
  const params = await context.params;
  return updateUserRole(req as NextRequest, auth, { params: params as { id: string } });
});
import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { banUser } from "@/server/controller/admin.controller";

// POST /api/admin/users/[id]/ban
export const POST = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, 'ban');
  const params = await context.params;
  return banUser(
    req as NextRequest,
    { params: Promise.resolve(params as unknown as Record<string, string>) },
    auth,
  );
});
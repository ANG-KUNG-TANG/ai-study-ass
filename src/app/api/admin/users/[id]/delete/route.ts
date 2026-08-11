import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getUser, deleteUser } from "@/server/controller/admin.controller";

// GET /api/admin/users/[id]
export const GET = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, "admin:get-user");
  const params = await context.params;
  return getUser(
    req as NextRequest,
    { params: Promise.resolve(params as unknown as Record<string, string>) },
    auth,
  );
});

// DELETE /api/admin/users/[id]
export const DELETE = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, "admin:delete-user");
  const params = await context.params;
  return deleteUser(
    req as NextRequest,
    { params: Promise.resolve(params as unknown as Record<string, string>) },
    auth,
  );
});
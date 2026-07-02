import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getUser, deleteUser } from "@/server/controller/admin.controller";

// GET /api/admin/users/[id]
export const GET = withRole("admin")(async (req, context, auth) => {
  apiLimiter(req);
  // NOTE: auth.middleware.ts's RouteContext types params as a Promise
  // (Next 15 async params), but admin.controller.ts's RouteParams still
  // types params as a plain object. Resolving the promise here so the
  // controller works unmodified — see flag #4.
  const params = await context.params;
  return getUser(req as NextRequest, auth, { params: params as { id: string } });
});

// DELETE /api/admin/users/[id]
export const DELETE = withRole("admin")(async (req, context, auth) => {
  apiLimiter(req);
  const params = await context.params;
  return deleteUser(req as NextRequest, auth, { params: params as { id: string } });
});
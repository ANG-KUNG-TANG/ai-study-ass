import type { NextRequest } from "next/server";
import { retryContent } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const POST = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:content:retry`);
  const params = await context.params;
  return retryContent(req as NextRequest, { params: Promise.resolve(params) }, auth);
});

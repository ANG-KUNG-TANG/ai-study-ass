import type { NextRequest } from "next/server";
import { getUserAIPolicy, updateUserAIPolicy } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:ai-policy:read`);
  const params = await context.params;
  return getUserAIPolicy(req as NextRequest, { params: Promise.resolve(params) }, auth);
});

export const PATCH = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:ai-policy:update`);
  const params = await context.params;
  return updateUserAIPolicy(req as NextRequest, { params: Promise.resolve(params) }, auth);
});

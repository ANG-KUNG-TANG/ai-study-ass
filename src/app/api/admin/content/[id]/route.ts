import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { deleteContent, getContent } from "@/server/controller/admin.controller";

export const GET = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:content:read`);
  const params = await context.params;
  return getContent(req as NextRequest, { params: Promise.resolve(params) }, auth);
});

export const DELETE = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:content:delete`);
  const params = await context.params;
  return deleteContent(req as NextRequest, { params: Promise.resolve(params) }, auth);
});

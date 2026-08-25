import type { NextRequest } from "next/server";
import { getSettings, updateSettings } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:settings:read`);
  return getSettings(req as NextRequest, { params: Promise.resolve({}) }, auth);
});

export const PATCH = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:settings:update`);
  return updateSettings(req as NextRequest, { params: Promise.resolve({}) }, auth);
});

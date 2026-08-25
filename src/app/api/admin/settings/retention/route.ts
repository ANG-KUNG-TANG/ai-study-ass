import type { NextRequest } from "next/server";
import { executeRetention, previewRetention } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:retention:preview`);
  return previewRetention(req as NextRequest, { params: Promise.resolve({}) }, auth);
});

export const POST = withRole("admin")(async (req, _context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:retention:execute`);
  return executeRetention(req as NextRequest, { params: Promise.resolve({}) }, auth);
});

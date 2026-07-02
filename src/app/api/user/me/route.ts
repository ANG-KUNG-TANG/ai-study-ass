import type { NextRequest } from "next/server";
import { withAuth } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { getProfile, updateProfile, deleteAccount } from "@/server/controller/user.controller";

// GET /api/user/me
export const GET = withAuth(async (req, _context, auth) => {
  apiLimiter(req);
  return getProfile(req as NextRequest, auth);
});

// PATCH /api/user/me
export const PATCH = withAuth(async (req, _context, auth) => {
  apiLimiter(req);
  return updateProfile(req as NextRequest, auth);
});

// DELETE /api/user/me
export const DELETE = withAuth(async (req, _context, auth) => {
  apiLimiter(req);
  return deleteAccount(req as NextRequest, auth);
});
import type { NextRequest } from "next/server";
import { withAuth } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import {
  getProfile,
  updateProfile,
  deleteAccount,
} from "@/server/controller/user.controller";

// GET /api/user/me
export const GET = withAuth(
  async (req, context, auth) => {
    apiLimiter(
      req,
      `user:${auth.userId}:profile:read`,
    );

    return getProfile(
      req as NextRequest,
      context,
      auth,
    );
  },
);

// PATCH /api/user/me
export const PATCH = withAuth(
  async (req, context, auth) => {
    apiLimiter(
      req,
      `user:${auth.userId}:profile:update`,
    );

    return updateProfile(
      req as NextRequest,
      context,
      auth,
    );
  },
);

// DELETE /api/user/me
export const DELETE = withAuth(
  async (req, context, auth) => {
    apiLimiter(
      req,
      `user:${auth.userId}:profile:delete`,
    );

    return deleteAccount(
      req as NextRequest,
      context,
      auth,
    );
  },
);
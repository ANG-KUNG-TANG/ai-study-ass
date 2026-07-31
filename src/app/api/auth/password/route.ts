// src/app/api/auth/password/route.ts

import { withAuth } from "@/server/middleware/auth.middleware";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { changePassword } from "@/server/controller/auth.controller";
import { NextRequest } from "next/server";

export const PATCH = withErrorHandler(
  withAuth(async ( req, ctx: any, auth) => {
    authLimiter(req, 'change-password');
    return  await changePassword(req as NextRequest, ctx, auth);
  })
);
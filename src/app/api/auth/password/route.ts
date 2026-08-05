import { NextRequest } from "next/server";

import { changePassword } from "@/server/controller/auth.controller";
import { withAuth, type RouteContext } from "@/server/middleware/auth.middleware";
import { withErrorHandler } from "@/server/middleware/error.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";

export const PATCH = withErrorHandler(
  withAuth(async (request, context: RouteContext, auth) => {
    authLimiter(request, "change-password");

    return changePassword(
      request as NextRequest,
      context,
      auth,
    );
  }),
);

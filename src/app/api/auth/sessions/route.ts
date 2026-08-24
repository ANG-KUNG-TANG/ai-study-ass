import type { NextRequest } from "next/server";

import { logoutAll } from "@/server/controller/auth.controller";
import { withAuth, type RouteContext } from "@/server/middleware/auth.middleware";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";

// DELETE /api/auth/sessions — revoke refresh and access tokens for every
// device owned by the authenticated user.
export const DELETE = withAuth(
  async (request, context: RouteContext, auth) => {
    await authLimiter(request, "logout-all");

    return logoutAll(
      request as NextRequest,
      context,
      auth,
    );
  },
);

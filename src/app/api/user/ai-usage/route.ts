import type {
  NextRequest,
} from "next/server";

import {
  withAuth,
} from "@/server/middleware/auth.middleware";

import {
  apiLimiter,
} from "@/server/middleware/rate_limiter.middleware";

import {
  getUserAIUsage,
} from "@/server/controller/ai-usage.controller";

// GET /api/user/ai-usage
export const GET =
  withAuth(
    async (
      req,
      context,
      auth,
    ) => {
      await apiLimiter(
        req,
        `user:${auth.userId}:ai-usage`,
      );

      return getUserAIUsage(
        req as NextRequest,
        context,
        auth,
      );
    },
  );

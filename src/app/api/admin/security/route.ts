import type { NextRequest } from "next/server";

import { getSecurityReport } from "@/server/controller/admin.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withRole("admin")(
  async (req, _context, auth) => {
    await apiLimiter(
      req,
      `admin:${auth.userId}:security`,
    );

    return getSecurityReport(
      req as NextRequest,
      {
        params: Promise.resolve(
          {} as Record<string, string>,
        ),
      },
      auth,
    );
  },
);

import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";
import { unbanUser } from "@/server/controller/admin.controller";

// POST /api/admin/users/[id]/unban
export const POST = withRole("admin")(
  async (req, context, auth) => {
    const params = await context.params;
    const id = params.id;

    apiLimiter(
      req,
      `admin:${auth.userId}:user:${id}:unban`,
    );

    return unbanUser(
    req as NextRequest,
    { params: Promise.resolve(params as unknown as Record<string, string>) },
    auth,
  );
  },
);
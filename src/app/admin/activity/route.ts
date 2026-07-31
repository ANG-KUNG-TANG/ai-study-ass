// src/app/api/admin/activity/route.ts (new file)
import type { NextRequest } from "next/server";
import { withRole } from "@/server/middleware/auth.middleware";
import { getRecentActivity } from "@/server/controller/admin.controller";

export const GET = withRole("admin")(async (req, context, auth) => {
  return getRecentActivity(req as NextRequest, context, auth);
});
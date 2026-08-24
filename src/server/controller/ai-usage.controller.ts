import type { NextRequest, NextResponse } from "next/server";

import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";

import { getUserAIUsageSummary } from "@/server/services/ai-usage.service";

import { successResponse } from "@/server/utils/response";

// GET /api/user/ai-usage
export async function getUserAIUsage(
  _req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const usage = await getUserAIUsageSummary(auth.userId);

  return successResponse(usage);
}

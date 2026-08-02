import type { NextRequest, NextResponse } from "next/server";
import * as userService from "@/server/services/user.service";
import { validateBody } from "@/server/middleware/validation.middleware";
import { noContentResponse, successResponse } from "@/server/utils/response";
import {
  deleteAccountSchema,
  updateProfileSchema,
  type DeleteAccountInput,
  type UpdateProfileInput,
} from "@/server/validators/user.validators";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import { logActivity } from "@/server/services/auditLog.service";

// GET /api/user/me
export async function getProfile(
  _req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await userService.getProfile(auth.userId));
}

// PATCH /api/user/me
export async function updateProfile(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const data = await validateBody(req, updateProfileSchema) as UpdateProfileInput;
  const user = await userService.updateProfile(auth.userId, data);

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "user.profile_updated",
    targetType: "user",
    targetId: auth.userId,
  });

  return successResponse(user);
}

// DELETE /api/user/me
export async function deleteAccount(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { password } = await validateBody(req, deleteAccountSchema) as DeleteAccountInput;
  await userService.deleteAccount(auth.userId, password);

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "user.account_deleted",
    targetType: "user",
    targetId: auth.userId,
  });

  return noContentResponse();
}

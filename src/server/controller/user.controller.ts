import type { NextRequest, NextResponse } from "next/server";
import * as userService from "@/server/services/user.service";
import { validateBody } from "@/server/middleware/validation.middleware";
import { successResponse, noContentResponse } from "@/server/utils/response";
import { updateProfileSchema, deleteAccountSchema } from "@/server/validators/user.validators";
import type { AuthContext } from "@/server/middleware/auth.middleware";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Self-service only — every handler acts on ctx.userId, sourced from the
// verified JWT via auth middleware. There is no :id route param here on
// purpose: a user can never act on another account through this controller.
// Admin operations on other users live in admin.controller.ts.

// ─── Read ─────────────────────────────────────────────────────────────────────

// GET /api/user/me
export async function getProfile(
  _req: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const user = await userService.getProfile(ctx.userId);
  return successResponse(user);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// PATCH /api/user/me
export async function updateProfile(
  req: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const data = await validateBody(req, updateProfileSchema);
  const user = await userService.updateProfile(ctx.userId, data);
  return successResponse(user);
}

// DELETE /api/user/me
export async function deleteAccount(
  req: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  const { password } = await validateBody(req, deleteAccountSchema);
  await userService.deleteAccount(ctx.userId, password);
  return noContentResponse();
}
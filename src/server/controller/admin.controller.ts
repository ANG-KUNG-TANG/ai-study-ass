import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import * as adminService from "@/server/services/admin.service";
import { validateBody, validateQuery } from "@/server/middleware/validation.middleware";
import { successResponse, noContentResponse, paginatedResponse } from "@/server/utils/response";
import { BadRequestError } from "@/server/utils/errors";
import { userQuerySchema, updateRoleSchema } from "@/server/validators/admin.validator";
import { noteQuerySchema } from "@/server/validators/note.validators";
import type { AuthContext } from "@/server/middleware/auth.middleware";
import * as auditLogService from "@/server/services/auditLog.service";
import { logActivity } from "@/server/services/auditLog.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ControllerContext = { params: { id: string } };

function requireUserId(id: string | undefined): string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new BadRequestError("Invalid user id");
  }
  return id;
}

// GET /api/admin/users
export async function listUsers(
  req: NextRequest,
  _auth: AuthContext
): Promise<NextResponse> {
  const query = validateQuery(req, userQuerySchema);
  const result = await adminService.listUsers(query);
  return paginatedResponse(result.data, result.meta, "Users retrieved");
}

// GET /api/admin/content
export async function listContent(
  req: NextRequest,
  _auth: AuthContext
): Promise<NextResponse> {
  const query = validateQuery(req, noteQuerySchema);
  const allowedSortBy = query.sortBy === "fileSize" ? undefined : query.sortBy;
  const result = await adminService.listContent({
    page: query.page,
    limit: query.limit,
    search: query.search,
    fileType: query.fileType,
    sortBy: allowedSortBy,
    sortOrder: query.sortOrder,
  });
  return paginatedResponse(result.data, result.meta, "Content retrieved");
}

// GET /api/admin/users/[id]
export async function getUser(
  _req: NextRequest,
  _auth: AuthContext,
  context: ControllerContext
): Promise<NextResponse> {
  const targetId = requireUserId(context.params.id);
  const user = await adminService.getUserById(targetId);
  return successResponse(user);
}

// GET /api/admin/users/stats
export async function getUserStats(
  _req: NextRequest,
  _auth: AuthContext
): Promise<NextResponse> {
  const stats = await adminService.getUserStats();
  return successResponse(stats);
}

// PATCH /api/admin/users/[id]/role
export async function updateUserRole(
  req: NextRequest,
  auth: AuthContext,
  context: ControllerContext
): Promise<NextResponse> {
  const targetId = requireUserId(context.params.id);
  const { role } = await validateBody(req, updateRoleSchema);
  await adminService.updateUserRole(auth.userId, targetId, role);
  const target = await adminService.getUserById(targetId);
  logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "admin.role_changed",
    targetType: "user",
    targetId,
    metadata: { newRole: role, targetEmail: target.email },
  });
  return successResponse({ message: "Role updated" });
}

// POST /api/admin/users/[id]/ban
export async function banUser(
  _req: NextRequest,
  auth: AuthContext,
  context: ControllerContext
): Promise<NextResponse> {
  const targetId = requireUserId(context.params.id);
  const target = await adminService.getUserById(targetId);
  await adminService.banUser(auth.userId, targetId);
  logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "admin.user_banned",
    targetType: "user",
    targetId,
    metadata: { targetEmail: target.email },
  });
  return successResponse({ message: "User banned" });
}

// POST /api/admin/users/[id]/unban
export async function unbanUser(
  _req: NextRequest,
  auth: AuthContext,
  context: ControllerContext
): Promise<NextResponse> {
  const targetId = requireUserId(context.params.id);
  await adminService.unbanUser(auth.userId, targetId);
  return successResponse({ message: "User unbanned" });
}

// DELETE /api/admin/users/[id]
export async function deleteUser(
  _req: NextRequest,
  auth: AuthContext,
  context: ControllerContext
): Promise<NextResponse> {
  const targetId = requireUserId(context.params.id);
  // Fetch before delete — nothing left to read the email from afterward.
  const target = await adminService.getUserById(targetId);
  await adminService.deleteUser(auth.userId, targetId);
  logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "admin.user_deleted",
    targetType: "user",
    targetId,
    metadata: { targetEmail: target.email },
  });
  return noContentResponse();
}

// GET /api/admin/overview
export async function getOverviewStats(
  _req: NextRequest,
  _auth: AuthContext
): Promise<NextResponse> {
  const stats = await adminService.getOverviewStats();
  return successResponse(stats);
}

// GET /api/admin/activity
export async function getRecentActivity(
  req: NextRequest,
  _auth: AuthContext
): Promise<NextResponse> {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam), 100) : 20;
  const activity = await auditLogService.getRecentActivity(limit);
  return successResponse(activity);
}
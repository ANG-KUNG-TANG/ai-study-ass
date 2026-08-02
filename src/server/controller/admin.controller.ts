import type { NextRequest, NextResponse } from "next/server";
import * as adminService from "@/server/services/admin.service";
import {
  validateBody,
  validateQuery,
} from "@/server/middleware/validation.middleware";
import {
  noContentResponse,
  paginatedResponse,
  successResponse,
} from "@/server/utils/response";
import { BadRequestError } from "@/server/utils/errors";
import {
  userQuerySchema,
  updateRoleSchema,
  type UserQueryInput,
  type UpdateRoleInput,
} from "@/server/validators/admin.validator";
import {
  noteQuerySchema,
  type NoteQueryInput,
} from "@/server/validators/note.validators";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as auditLogService from "@/server/services/auditLog.service";
import { logActivity } from "@/server/services/auditLog.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUserId(id: string | undefined): string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new BadRequestError("Invalid user id");
  }
  return id;
}

async function getRouteId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const id = params.id ?? params.noteId ?? params.noteid;
  if (!id) throw new BadRequestError("Missing route id");
  return id;
}

async function getTargetUserId(context: RouteContext): Promise<string> {
  return requireUserId(await getRouteId(context));
}

// GET /api/admin/users
export async function listUsers(
  req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const query = validateQuery(req, userQuerySchema) as UserQueryInput;
  const result = await adminService.listUsers(query);
  return paginatedResponse(result.data, result.meta, "Users retrieved");
}

// GET /api/admin/content
export async function listContent(
  req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const query = validateQuery(req, noteQuerySchema) as NoteQueryInput;
  const result = await adminService.listContent({
    page: query.page,
    limit: query.limit,
    search: query.search,
    fileType: query.fileType,
    sortBy: query.sortBy === "fileSize" ? undefined : query.sortBy,
    sortOrder: query.sortOrder,
  });
  return paginatedResponse(result.data, result.meta, "Content retrieved");
}

// DELETE /api/admin/content/[id]
export async function deleteContent(
  _req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getRouteId(context);
  const deleted = await adminService.deleteContent(auth.userId, noteId);

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "note.deleted",
    targetType: "note",
    targetId: noteId,
    metadata: {
      title: deleted.title,
      ownerId: deleted.ownerId,
      deletedByAdmin: true,
    },
  });

  return noContentResponse();
}

// GET /api/admin/users/[id]
export async function getUser(
  _req: NextRequest,
  context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const targetId = await getTargetUserId(context);
  return successResponse(await adminService.getUserById(targetId));
}

// GET /api/admin/users/stats
export async function getUserStats(
  _req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getUserStats());
}

// PATCH /api/admin/users/[id]/role
export async function updateUserRole(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const targetId = await getTargetUserId(context);
  const { role } = await validateBody(req, updateRoleSchema) as UpdateRoleInput;
  await adminService.updateUserRole(auth.userId, targetId, role);
  const target = await adminService.getUserById(targetId);

  void logActivity({
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
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const targetId = await getTargetUserId(context);
  const target = await adminService.getUserById(targetId);
  await adminService.banUser(auth.userId, targetId);

  void logActivity({
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
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const targetId = await getTargetUserId(context);
  const target = await adminService.getUserById(targetId);
  await adminService.unbanUser(auth.userId, targetId);

  void logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "admin.user_unbanned",
    targetType: "user",
    targetId,
    metadata: { targetEmail: target.email },
  });

  return successResponse({ message: "User unbanned" });
}

// DELETE /api/admin/users/[id]
export async function deleteUser(
  _req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const targetId = await getTargetUserId(context);
  const target = await adminService.getUserById(targetId);
  await adminService.deleteUser(auth.userId, targetId);

  void logActivity({
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
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getOverviewStats());
}

// GET /api/admin/ai-usage
export async function getAIUsage(
  _req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getAIUsage());
}

// GET /api/admin/health
export async function getSystemHealth(
  _req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getSystemHealth());
}

// GET /api/admin/activity?page=1&limit=20
export async function getRecentActivity(
  req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const pageValue = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limitValue = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
  const limit = Number.isFinite(limitValue)
    ? Math.min(100, Math.max(1, Math.floor(limitValue)))
    : 20;
  const result = await auditLogService.listActivity(page, limit);
  return paginatedResponse(result.data, result.meta, "Activity retrieved");
}

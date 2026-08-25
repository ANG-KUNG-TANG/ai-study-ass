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
  adminContentQuerySchema,
  activityQuerySchema,
  adminReasonSchema,
  userAIPolicySchema,
  operationalSettingsSchema,
  type UserQueryInput,
  type UpdateRoleInput,
  type AdminContentQueryInput,
  type ActivityQueryInput,
  type AdminReasonInput,
  type UserAIPolicyInput,
  type OperationalSettingsInput,
} from "@/server/validators/admin.validator";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import * as auditLogService from "@/server/services/auditLog.service";
import { logActivity } from "@/server/services/auditLog.service";
import { getSecurityReport as buildSecurityReport } from "@/server/services/security-monitoring.service";
import { getClientIp } from "@/server/utils/client-ip";

function auditContext(req: NextRequest, auth: AuthContext) {
  return {
    actorId: auth.userId,
    actorEmail: auth.email,
    actorRole: "admin" as const,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
    requestId: req.headers.get("x-request-id") ?? undefined,
  };
}

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
  const query = validateQuery(req, adminContentQuerySchema) as AdminContentQueryInput;
  const result = await adminService.listContent({
    page: query.page,
    limit: query.limit,
    search: query.search,
    fileType: query.fileType,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    adminStatus: query.adminStatus,
  });
  return paginatedResponse(result.data, result.meta, "Content retrieved");
}

// DELETE /api/admin/content/[id]
export async function deleteContent(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const noteId = await getRouteId(context);
  const deleted = await adminService.deleteContent(auth.userId, noteId);

  await logActivity({
    ...auditContext(req, auth),
    action: "note.deleted",
    targetType: "note",
    targetId: noteId,
    metadata: {
      title: deleted.title,
      ownerId: deleted.ownerId,
      deletedByAdmin: true,
    },
    reason,
  });

  return noContentResponse();
}

export async function getContent(
  _req: NextRequest,
  context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getContentById(await getRouteId(context)));
}

export async function retryContent(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getRouteId(context);
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const result = await adminService.retryContent(auth.userId, noteId);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.content_retried",
    targetType: "note",
    targetId: noteId,
    reason,
    metadata: { ...result },
  });
  return successResponse(result, { status: 202, message: "Content retry queued" });
}

export async function cancelContent(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getRouteId(context);
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const result = await adminService.cancelContentProcessing(auth.userId, noteId);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.content_cancelled",
    targetType: "note",
    targetId: noteId,
    reason,
    metadata: { ...result },
  });
  return successResponse(result, { message: "Content processing cancelled" });
}

export async function quarantineContent(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getRouteId(context);
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const result = await adminService.quarantineContent(auth.userId, noteId, reason);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.content_quarantined",
    targetType: "note",
    targetId: noteId,
    reason,
  });
  return successResponse(result, { message: "Content quarantined" });
}

export async function restoreContent(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const noteId = await getRouteId(context);
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const result = await adminService.restoreContent(auth.userId, noteId);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.content_restored",
    targetType: "note",
    targetId: noteId,
    reason,
  });
  return successResponse(result, { message: "Content restored" });
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

export async function getUserAIPolicy(
  _req: NextRequest,
  context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getUserAIAdminPolicy(await getTargetUserId(context)));
}

export async function updateUserAIPolicy(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const userId = await getTargetUserId(context);
  const input = await validateBody(req, userAIPolicySchema) as UserAIPolicyInput;
  const result = await adminService.updateUserAIAdminPolicy(auth.userId, userId, {
    enabled: input.enabled,
    dailyRequestLimit: input.dailyRequestLimit,
    dailyTokenLimit: input.dailyTokenLimit,
  });
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.ai_policy_changed",
    targetType: "user",
    targetId: userId,
    reason: input.reason,
    metadata: { ...result },
  });
  return successResponse(result, { message: "AI policy updated" });
}

export async function revokeUserSessions(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const userId = await getTargetUserId(context);
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  await adminService.revokeUserSessions(auth.userId, userId);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.sessions_revoked",
    targetType: "user",
    targetId: userId,
    reason,
  });
  return successResponse({ message: "Sessions revoked" });
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
  const { role, reason } = await validateBody(req, updateRoleSchema) as UpdateRoleInput;
  await adminService.updateUserRole(auth.userId, targetId, role);
  const target = await adminService.getUserById(targetId);

  await logActivity({
    ...auditContext(req, auth),
    action: "admin.role_changed",
    targetType: "user",
    targetId,
    metadata: { newRole: role, targetEmail: target.email },
    reason,
  });

  return successResponse({ message: "Role updated" });
}

// POST /api/admin/users/[id]/ban
export async function banUser(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const targetId = await getTargetUserId(context);
  const target = await adminService.getUserById(targetId);
  await adminService.banUser(auth.userId, targetId);

  await logActivity({
    ...auditContext(req, auth),
    action: "admin.user_banned",
    targetType: "user",
    targetId,
    metadata: { targetEmail: target.email },
    reason,
  });

  return successResponse({ message: "User banned" });
}

// POST /api/admin/users/[id]/unban
export async function unbanUser(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const targetId = await getTargetUserId(context);
  const target = await adminService.getUserById(targetId);
  await adminService.unbanUser(auth.userId, targetId);

  await logActivity({
    ...auditContext(req, auth),
    action: "admin.user_unbanned",
    targetType: "user",
    targetId,
    metadata: { targetEmail: target.email },
    reason,
  });

  return successResponse({ message: "User unbanned" });
}

// DELETE /api/admin/users/[id]
export async function deleteUser(
  req: NextRequest,
  context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const targetId = await getTargetUserId(context);
  const target = await adminService.getUserById(targetId);
  await adminService.deleteUser(auth.userId, targetId);

  await logActivity({
    ...auditContext(req, auth),
    action: "admin.user_deleted",
    targetType: "user",
    targetId,
    metadata: { targetEmail: target.email },
    reason,
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
  const query = validateQuery(req, activityQuerySchema) as ActivityQueryInput;
  const result = await auditLogService.listActivity(query);
  return paginatedResponse(result.data, result.meta, "Activity retrieved");
}

export async function exportActivity(
  req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const query = validateQuery(req, activityQuerySchema) as ActivityQueryInput;
  const { page: _page, limit: _limit, ...filters } = query;
  return successResponse({ csv: await auditLogService.exportActivityCsv(filters) });
}

// GET /api/admin/security?window=15
export async function getSecurityReport(
  req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  const rawWindow = Number(
    req.nextUrl.searchParams.get("window") ?? 15,
  );

  const windowMinutes = Number.isFinite(rawWindow)
    ? Math.min(1_440, Math.max(5, Math.floor(rawWindow)))
    : 15;

  return successResponse(
    await buildSecurityReport(windowMinutes),
  );
}

export async function getSettings(
  _req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.getSettings());
}

export async function updateSettings(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const input = await validateBody(req, operationalSettingsSchema) as OperationalSettingsInput;
  const { reason, ...settings } = input;
  const result = await adminService.updateSettings(auth.userId, settings);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.settings_changed",
    targetType: "operational_settings",
    targetId: "system",
    reason,
    metadata: settings,
  });
  return successResponse(result, { message: "Operational settings updated" });
}

export async function previewRetention(
  _req: NextRequest,
  _context: RouteContext,
  _auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await adminService.previewRetention());
}

export async function executeRetention(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const result = await adminService.executeRetention(auth.userId);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.retention_executed",
    targetType: "retention_policy",
    targetId: "system",
    reason,
    metadata: result,
  });
  return successResponse(result, { message: "Retention policy executed" });
}

export async function testAIProvider(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const { reason } = await validateBody(req, adminReasonSchema) as AdminReasonInput;
  const result = await adminService.testAIProvider(auth.userId);
  await logActivity({
    ...auditContext(req, auth),
    action: "admin.provider_tested",
    targetType: "ai_provider",
    targetId: result.provider,
    reason,
    metadata: {
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
    },
  });
  return successResponse(result);
}

import {
  apiFetch,
  apiFetchPaginated,
} from "@/lib/api";
import type {
  User,
} from "@/types/user";
import type {
  PaginationMeta,
} from "@/types/pagination";
import type {
  AdminActivityItem,
  AdminActivityQuery,
  AdminAIUsage,
  AdminContentItem,
  AdminContentDetail,
  AdminContentQuery,
  AdminOverviewStats,
  AdminUserQuery,
  UserStats,
  AdminUserAIPolicy,
  OperationalSettings,
  SecurityReport,
} from "@/types/admin";

function toQueryString(
  values: Record<
    string,
    string | number | boolean | undefined
  >,
): string {
  const query =
    new URLSearchParams();

  for (
    const [key, value] of
    Object.entries(values)
  ) {
    if (
      value !== undefined &&
      value !== ""
    ) {
      query.set(
        key,
        String(value),
      );
    }
  }

  const result =
    query.toString();

  return result
    ? `?${result}`
    : "";
}

function buildUserQuery(
  params: AdminUserQuery = {},
): string {
  return toQueryString({
    page:
      params.page,
    limit:
      params.limit,
    search:
      params.search,
    role:
      params.role,
    isActive:
      params.isActive,
  });
}

function buildActivityQuery(
  params: AdminActivityQuery = {},
): string {
  return toQueryString({
    page:
      params.page,
    limit:
      params.limit,
    search: params.search,
    action: params.action,
    category: params.category,
    status: params.status,
    targetType: params.targetType,
    actorId: params.actorId,
    from: params.from,
    to: params.to,
  });
}

function buildContentQuery(
  params: AdminContentQuery = {},
): string {
  return toQueryString({
    page:
      params.page,
    limit:
      params.limit,
    search:
      params.search,
    fileType:
      params.fileType,
    sortBy:
      params.sortBy,
    sortOrder:
      params.sortOrder,
    adminStatus: params.adminStatus,
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function listUsers(
  params?: AdminUserQuery,
): Promise<{
  data: User[];
  meta: PaginationMeta;
}> {
  return apiFetchPaginated<User>(
    `/admin/users${buildUserQuery(
      params,
    )}`,
  );
}

export function getUserStats():
  Promise<UserStats> {
  return apiFetch<UserStats>(
    "/admin/users/stats",
  );
}

export function updateUserRole(
  id: string,
  role: "user" | "admin",
  reason: string,
): Promise<{
  message: string;
}> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({
        role,
        reason,
      }),
    },
  );
}

export function banUser(
  id: string,
  reason: string,
): Promise<{
  message: string;
}> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}/ban`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

export function unbanUser(
  id: string,
  reason: string,
): Promise<{
  message: string;
}> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}/unban`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

export function deleteUser(
  id: string,
  reason: string,
): Promise<void> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    },
  );
}

export function getAdminUser(id: string): Promise<User> {
  return apiFetch<User>(`/admin/users/${encodeURIComponent(id)}`);
}

export function getAdminUserAIPolicy(id: string): Promise<AdminUserAIPolicy> {
  return apiFetch(`/admin/users/${encodeURIComponent(id)}/ai-policy`);
}

export function updateAdminUserAIPolicy(
  id: string,
  input: { enabled: boolean; dailyRequestLimit: number | null; dailyTokenLimit: number | null; reason: string },
): Promise<AdminUserAIPolicy["stored"]> {
  return apiFetch(`/admin/users/${encodeURIComponent(id)}/ai-policy`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function revokeAdminUserSessions(id: string, reason: string): Promise<{ message: string }> {
  return apiFetch(`/admin/users/${encodeURIComponent(id)}/sessions/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ─── Overview and activity ───────────────────────────────────────────────────

export function getOverviewStats():
  Promise<AdminOverviewStats> {
  return apiFetch<AdminOverviewStats>(
    "/admin/overview",
  );
}

export function getAdminActivity(
  params?: AdminActivityQuery,
): Promise<{
  data: AdminActivityItem[];
  meta: PaginationMeta;
}> {
  return apiFetchPaginated<AdminActivityItem>(
    `/admin/activity${buildActivityQuery(
      params,
    )}`,
  );
}

export async function exportAdminActivity(params?: AdminActivityQuery): Promise<void> {
  const result = await apiFetch<{ csv: string }>(`/admin/activity/export${buildActivityQuery(params)}`);
  const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Content ─────────────────────────────────────────────────────────────────

export function listAdminContent(
  params?: AdminContentQuery,
): Promise<{
  data: AdminContentItem[];
  meta: PaginationMeta;
}> {
  return apiFetchPaginated<AdminContentItem>(
    `/admin/content${buildContentQuery(
      params,
    )}`,
  );
}

export function deleteAdminContent(
  id: string,
  reason: string,
): Promise<void> {
  return apiFetch(
    `/admin/content/${encodeURIComponent(
      id,
    )}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    },
  );
}

export function getAdminContent(id: string): Promise<AdminContentDetail> {
  return apiFetch(`/admin/content/${encodeURIComponent(id)}`);
}

function contentAction(id: string, action: string, reason: string): Promise<unknown> {
  return apiFetch(`/admin/content/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export const retryAdminContent = (id: string, reason: string) => contentAction(id, "retry", reason);
export const cancelAdminContent = (id: string, reason: string) => contentAction(id, "cancel", reason);
export const quarantineAdminContent = (id: string, reason: string) => contentAction(id, "quarantine", reason);
export const restoreAdminContent = (id: string, reason: string) => contentAction(id, "restore", reason);

// ─── AI usage ────────────────────────────────────────────────────────────────

export function getAdminAIUsage():
  Promise<AdminAIUsage> {
  return apiFetch<AdminAIUsage>(
    "/admin/ai-usage",
  );
}

export function testAdminAIProvider(reason: string): Promise<{
  provider: "openai" | "gemini";
  model: string;
  tokensUsed: number;
  response: string;
}> {
  return apiFetch("/admin/ai-usage/test", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getAdminSettings(): Promise<OperationalSettings> {
  return apiFetch("/admin/settings");
}

export function updateAdminSettings(
  settings: Omit<OperationalSettings, "id" | "updatedBy" | "createdAt" | "updatedAt">,
  reason: string,
): Promise<OperationalSettings> {
  return apiFetch("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({ ...settings, reason }),
  });
}

export function previewAdminRetention(): Promise<{
  auditLogs: number;
  content: number;
  auditCutoff: string;
  contentCutoff: string | null;
}> {
  return apiFetch("/admin/settings/retention");
}

export function executeAdminRetention(reason: string): Promise<{
  deletedAuditLogs: number;
  deletedContent: number;
}> {
  return apiFetch("/admin/settings/retention", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getAdminSecurity(windowMinutes: number): Promise<SecurityReport> {
  return apiFetch(`/admin/security?window=${encodeURIComponent(String(windowMinutes))}`);
}

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
  AdminContentQuery,
  AdminOverviewStats,
  AdminUserQuery,
  UserStats,
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
      }),
    },
  );
}

export function banUser(
  id: string,
): Promise<{
  message: string;
}> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}/ban`,
    {
      method: "POST",
    },
  );
}

export function unbanUser(
  id: string,
): Promise<{
  message: string;
}> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}/unban`,
    {
      method: "POST",
    },
  );
}

export function deleteUser(
  id: string,
): Promise<void> {
  return apiFetch(
    `/admin/users/${encodeURIComponent(
      id,
    )}`,
    {
      method: "DELETE",
    },
  );
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
): Promise<void> {
  return apiFetch(
    `/admin/content/${encodeURIComponent(
      id,
    )}`,
    {
      method: "DELETE",
    },
  );
}

// ─── AI usage ────────────────────────────────────────────────────────────────

export function getAdminAIUsage():
  Promise<AdminAIUsage> {
  return apiFetch<AdminAIUsage>(
    "/admin/ai-usage",
  );
}

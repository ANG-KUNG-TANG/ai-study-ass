import { apiFetch, apiFetchPaginated } from "@/lib/api";
import type { User } from "@/types/user";
import type { PaginationMeta } from "@/types/pagination";
import type { UserStats, AdminUserQuery } from "@/types/admin";

function buildQuery(params: AdminUserQuery = {}): string {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  if (params.isActive !== undefined) query.set("isActive", String(params.isActive));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listUsers(params?: AdminUserQuery): Promise<{ data: User[]; meta: PaginationMeta }> {
  return apiFetchPaginated<User>(`/admin/users${buildQuery(params)}`);
}

export function getUserStats(): Promise<UserStats> {
  return apiFetch<UserStats>("/admin/users/stats");
}

export function updateUserRole(id: string, role: "user" | "admin"): Promise<{ message: string }> {
  return apiFetch(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
}

export function banUser(id: string): Promise<{ message: string }> {
  return apiFetch(`/admin/users/${id}/ban`, { method: "POST" });
}

export function unbanUser(id: string): Promise<{ message: string }> {
  return apiFetch(`/admin/users/${id}/unban`, { method: "POST" });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch(`/admin/users/${id}`, { method: "DELETE" });
}

export function getOverviewStats(): Promise<{
  totalUsers: number;
  totalNotes: number;
  totalQuizzes: number;
}> {
  return apiFetch("/admin/overview");
}
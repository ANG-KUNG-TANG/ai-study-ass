import type { User } from "@/types/user";

export type AppSection = "admin" | "student";

export function sectionForRole(
  role: User["role"],
): AppSection {
  return role === "admin" ? "admin" : "student";
}

export function dashboardForRole(
  role: User["role"],
): string {
  return role === "admin"
    ? "/admin/overview"
    : "/student/dashboard";
}

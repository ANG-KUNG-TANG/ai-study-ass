// src/hooks/useAuth.ts
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth as useAuthContext } from "@/context/AuthContext";
import type { User } from "@/types/user";
import { sectionForRole } from "@/utils/auth-routing";

// Single source of truth for "where does this user land after login".
function resolveHomeRoute(user: User): string {
  return sectionForRole(user.role) === "admin" ? "/admin/dashboard" : "/student/dashboard";
}

export function useAuth() {
  const ctx = useAuthContext();
  const router = useRouter();

  const loginAndRedirect = useCallback(
    async (email: string, password: string) => {
      const user = await ctx.login(email, password);
      router.push(resolveHomeRoute(user));
    },
    [ctx, router]
  );

  const logoutAndRedirect = useCallback(async () => {
    await ctx.logout();
    router.push("/auth/login");
  }, [ctx, router]);

  return {
    ...ctx,
    loginAndRedirect,
    logoutAndRedirect,
    resolveHomeRoute,
  };
}
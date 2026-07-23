"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, refreshAccessToken } from "@/lib/api";
import { setAccessToken } from "@/lib/auth-token-store";
import type { User } from "@/types/user";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);

  const loadUser = useCallback(async () => {
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  // Initial session check (runs once on mount).
  // Uses the shared refreshAccessToken() from lib/api.ts rather than its own
  // fetch — this keeps it deduped with any refresh triggered by a 401'd API
  // call elsewhere on the page, so only one refresh request is ever in
  // flight. Two concurrent refresh calls will trip the backend's reuse
  // detection and revoke the whole session.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          await loadUser();
        }
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [loadUser]);

  // NOTE: no navigation here. AuthContext only owns auth state.
  // Redirects (where to send the user after login/logout) live in
  // useAuth.ts's loginAndRedirect/logoutAndRedirect — keeping one owner
  // for route decisions instead of two callbacks racing each other.
  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore any error from the server – we still want to clear client state
      console.warn("Logout API failed, clearing local session anyway.");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Only two roles exist ("user" | "admin"), but "user" maps to the /student/*
// route tree — this is the single place that mapping is defined.
export type Section = "admin" | "student";

export function sectionForRole(role: User["role"]): Section {
  return role === "admin" ? "admin" : "student";
}

// Wrap admin/student layouts with this. Redirects unauthenticated users to
// /auth/login and wrong-section users back to their own dashboard.
export function RequireRole({ section, children }: { section: Section; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (sectionForRole(user.role) !== section) {
      router.replace(sectionForRole(user.role) === "admin" ? "/admin/dashboard" : "/student/dashboard");
    }
  }, [isLoading, user, section, router]);

  if (isLoading || !user || sectionForRole(user.role) !== section) return null;
  return <>{children}</>;
}
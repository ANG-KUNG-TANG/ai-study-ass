"use client";
import { useState, useEffect, useCallback } from "react";
import * as adminService from "@/services/admin.service";
import type { User } from "@/types/user";
import type { PaginationMeta } from "@/types/pagination";
import type { AdminUserQuery } from "@/types/admin";

export function useAdminUsers(params?: AdminUserQuery) {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetch = useCallback(() => setRefetchIndex((i) => i + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminService.listUsers(params);
        if (!cancelled) {
          setUsers(result.data);
          setMeta(result.meta);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchIndex, params?.page, params?.limit, params?.search, params?.role, params?.isActive]);

  return { users, meta, isLoading, error, refetch };
}
import { getAccessToken, setAccessToken } from "./auth-token-store";
import type { PaginationMeta } from "@/types/pagination";

const API_BASE = "/api";

// ─── Token refresh ──────────────────────────────────────────────────────────
// IMPORTANT: this is the ONLY place that should call POST /auth/refresh.
// AuthContext's mount-time session check also calls this function rather
// than firing its own fetch — that's what keeps refresh calls deduped
// app-wide. Two independent refresh calls racing each other will trip the
// backend's reuse-detection and log the user out of everything, so if you
// ever need to trigger a refresh from a new call site, import this function
// instead of writing a new fetch("/api/auth/refresh") anywhere else.

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const data = await res.json();
        setAccessToken(data.data?.accessToken ?? null);
        return true;
      })
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

function buildHeaders(
  skipAuth: boolean | undefined,
  headers: HeadersInit | undefined,
  isFormData: boolean
): HeadersInit {
  const token = getAccessToken();
  const base: Record<string, string> = {};

  if (!isFormData) {
    base["Content-Type"] = "application/json";
  }
  if (!skipAuth && token) {
    base["Authorization"] = `Bearer ${token}`;
  }

  return { ...base, ...headers };
}

async function rawRequest(path: string, options: ApiOptions): Promise<{ body: any; res: Response }> {
  const { skipAuth, headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  let res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildHeaders(skipAuth, headers, isFormData),
    credentials: "include",
  });

  // ✅ Skip refresh for auth/logout and auth/refresh to avoid loops
  const shouldSkipRefresh = path === "/auth/logout" || path === "/auth/refresh";

  if (res.status === 401 && !skipAuth && !shouldSkipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: buildHeaders(skipAuth, headers, isFormData),
        credentials: "include",
      });
    }
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }

  return { body, res };
}

// For single-resource endpoints — GET /notes/[id], POST /auth/login, etc.
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body } = await rawRequest(path, options);
  return body?.data as T;
}

// For list endpoints using paginatedResponse() on the backend — keeps `meta` intact.
export async function apiFetchPaginated<T>(
  path: string,
  options: ApiOptions = {}
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const { body } = await rawRequest(path, options);
  return { data: body?.data ?? [], meta: body?.meta };
}
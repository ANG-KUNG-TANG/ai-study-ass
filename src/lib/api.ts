import { getAccessToken, setAccessToken } from "./auth-token-store";
import type { PaginationMeta } from "@/types/pagination";

const API_BASE = "/api";

let refreshPromise: Promise<boolean> | null = null;

type JsonRecord = Record<string, unknown>;

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

async function readJson(response: Response): Promise<JsonRecord | null> {
  const value: unknown = await response.json().catch(() => null);
  return asRecord(value);
}

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          setAccessToken(null);
          return false;
        }

        const body = await readJson(response);
        const data = asRecord(body?.data);
        const accessToken =
          typeof data?.accessToken === "string"
            ? data.accessToken
            : null;

        setAccessToken(accessToken);
        return Boolean(accessToken);
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

function buildHeaders(
  skipAuth: boolean | undefined,
  headers: HeadersInit | undefined,
  isFormData: boolean,
): HeadersInit {
  const token = getAccessToken();
  const base: Record<string, string> = {};

  if (!isFormData) {
    base["Content-Type"] = "application/json";
  }

  if (!skipAuth && token) {
    base.Authorization = `Bearer ${token}`;
  }

  return {
    ...base,
    ...headers,
  };
}

async function rawRequest(
  path: string,
  options: ApiOptions,
): Promise<{ body: JsonRecord | null; response: Response }> {
  const { skipAuth, headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  const execute = () =>
    fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: buildHeaders(skipAuth, headers, isFormData),
      credentials: "include",
    });

  let response = await execute();

  const shouldSkipRefresh =
    path === "/auth/logout" ||
    path === "/auth/refresh";

  if (response.status === 401 && !skipAuth && !shouldSkipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await execute();
    }
  }

  const body = await readJson(response);

  if (!response.ok) {
    const error = asRecord(body?.error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : `Request failed: ${response.status}`;

    throw new Error(message);
  }

  return {
    body,
    response,
  };
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body } = await rawRequest(path, options);
  return body?.data as T;
}

export async function apiFetchPaginated<T>(
  path: string,
  options: ApiOptions = {},
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const { body } = await rawRequest(path, options);

  return {
    data: Array.isArray(body?.data) ? (body.data as T[]) : [],
    meta: body?.meta as PaginationMeta,
  };
}

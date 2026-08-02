import type { NextRequest } from "next/server";
import { RateLimitError } from "@/server/utils/errors";
import {
  RATE_LIMIT_AUTH,
  RATE_LIMIT_AI,
  RATE_LIMIT_API,
} from "@/server/utils/constants";
import { logActivity } from "@/server/services/auditLog.service";

interface RateLimitGlobal {
  __recallRateLimitStore?: Map<string, number[]>;
  __recallRateLimitCleanup?: ReturnType<typeof setInterval>;
}

const rateLimitGlobal = globalThis as typeof globalThis & RateLimitGlobal;
const store = rateLimitGlobal.__recallRateLimitStore ?? new Map<string, number[]>();
rateLimitGlobal.__recallRateLimitStore = store;

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_WINDOW_MS = Math.max(
  RATE_LIMIT_AUTH.windowMs,
  RATE_LIMIT_API.windowMs,
  RATE_LIMIT_AI.windowMs,
);

if (!rateLimitGlobal.__recallRateLimitCleanup) {
  const timer = setInterval(() => {
    const cutoff = Date.now() - MAX_WINDOW_MS;

    for (const [key, timestamps] of store.entries()) {
      const valid = timestamps.filter((timestamp) => timestamp > cutoff);
      if (valid.length === 0) store.delete(key);
      else store.set(key, valid);
    }
  }, CLEANUP_INTERVAL_MS);

  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref();
  }

  rateLimitGlobal.__recallRateLimitCleanup = timer;
}

function getIP(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anonymous";

  return req.headers.get("x-real-ip") ??
    (process.env.NODE_ENV === "production" ? "anonymous" : "dev-local");
}

function checkSlidingWindow(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = (store.get(key) ?? []).filter(
    (timestamp) => timestamp > now - windowMs,
  );

  if (timestamps.length >= limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(1, timestamps[0] + windowMs - now),
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

function createLimiter(limit: number, windowMs: number) {
  return function applyLimit(
    req: NextRequest | Request,
    identifier: string,
  ): void {
    if (!identifier.trim()) {
      throw new Error("Rate limiter identifier is required");
    }

    const ip = getIP(req);
    const result = checkSlidingWindow(`${identifier}:${ip}`, limit, windowMs);

    if (result.allowed) return;

    const route = new URL(req.url).pathname;
    void logActivity({
      actorId: null,
      actorEmail: null,
      action: "rate_limit.hit",
      metadata: { route, ip, identifier },
    });

    throw new RateLimitError(
      `Too many requests — try again in ${Math.ceil(result.retryAfterMs / 1_000)} seconds`,
      result.retryAfterMs,
    );
  };
}

export const authLimiter = createLimiter(
  RATE_LIMIT_AUTH.max,
  RATE_LIMIT_AUTH.windowMs,
);
export const apiLimiter = createLimiter(
  RATE_LIMIT_API.max,
  RATE_LIMIT_API.windowMs,
);
export const aiLimiter = createLimiter(
  RATE_LIMIT_AI.max,
  RATE_LIMIT_AI.windowMs,
);

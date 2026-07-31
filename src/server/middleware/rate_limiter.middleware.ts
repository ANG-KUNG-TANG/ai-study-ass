import { NextRequest } from "next/server";
import { RateLImitError } from "@/server/utils/errors";
import { RATE_LIMIT_AUTH, RATE_LIMIT_AI, RATE_LIMIT_API } from "../utils/constants";
import { logActivity } from "../services/auditLog.service";

// ─── Store ──────────────────────────────────────────────────────────────────
/**
 * Sliding window log — stores every request timestamp per key.
 * More accurate than a fixed window: no boundary-bypass attack possible.
 * Dev / single-instance only — replace with Upstash Redis in production.
 */
const store = new Map<string, number[]>();

// ─── Cleanup ────────────────────────────────────────────────────────────────
/**
 * Runs every 60s, removes stale timestamps and empty keys.
 * Without this, the map grows unbounded — memory leak in long-running processes.
 */
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_WINDOW_MS = Math.max(
  RATE_LIMIT_AUTH.windowMs,
  RATE_LIMIT_API.windowMs,
  RATE_LIMIT_AI.windowMs
);

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store.entries()) {
    const valid = timestamps.filter((ts) => ts > now - MAX_WINDOW_MS);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ─── IP resolution ──────────────────────────────────────────────────────────
/**
 * NextRequest.ip was removed in recent Next.js versions, so that check
 * never succeeds — kept only as a defensive no-op for older runtimes.
 * In dev, with no reverse proxy setting x-forwarded-for/x-real-ip, every
 * request falls through to a fixed dev key. That's expected locally —
 * in production behind a real proxy, XFF/x-real-ip will be set and this
 * resolves per-client as intended. If you need real per-client separation
 * in local dev too, run behind a local reverse proxy that sets XFF.
 */
function getIP(req: NextRequest | Request): string {
  // NextRequest.ip was removed in recent Next.js versions; keep a defensive
  // check for older runtimes by using a loose any cast to avoid TS errors.
  if ((req as any).ip) return (req as any).ip as string;

  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp;

  return process.env.NODE_ENV === "production" ? "anonymous" : "dev-local";
}

// ─── Core sliding window check ──────────────────────────────────────────────
function slidingWindowCheck(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get timestamps within the current window only
  const timestamps = (store.get(key) ?? []).filter((ts) => ts > windowStart);

  if (timestamps.length >= limit) {
    // Time until the oldest request in the window expires
    const retryAfterMs = timestamps[0] + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  // Record this request
  timestamps.push(now);
  store.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    retryAfterMs: 0,
  };
}

// ─── Limiter factory ────────────────────────────────────────────────────────
/**
 * Returns a function that enforces the limit for a given route/identifier.
 * Call at the top of any route handler — throws RateLimitError if exceeded.
 *
 * IMPORTANT: always pass a route-specific `identifier`. Without one, every
 * call to the same limiter (e.g. every auth route) shares one bucket, so
 * register/login/refresh traffic all counts against the same limit.
 *
 * Usage:
 *   export const POST = withErrorHandler(async (req) => {
 *     authLimiter(req, "register"); // throws if over limit
 *     await connectDB();
 *     ...
 *   });
 */
function createLimiter(limit: number, windowMs: number) {
  return function applyLimit(req: NextRequest | Request, identifier: string): void {
    const ip = getIP(req);
    const key = `${identifier}:${ip}`;

    const { allowed, retryAfterMs } = slidingWindowCheck(key, limit, windowMs);
    if (!allowed) {
      const url = new URL(req.url);
      logActivity({
        actorId: null,
        actorEmail: null,
        action: "rate_limit.hit",
        metadata: { route: url.pathname, ip, identifier },
      });
      throw new RateLImitError(
        `Too many requests - please try again in ${Math.ceil(retryAfterMs / 1000)} seconds`,
        retryAfterMs
      );
    }
  };
}

// ─── Named limiters ─────────────────────────────────────────────────────────
// Auth routes: 10 req / 15 min — brute-force protection.
// Each call site MUST pass its own identifier (e.g. "register", "login",
// "refresh") so they don't share a bucket.
export const authLimiter = createLimiter(RATE_LIMIT_AUTH.max, RATE_LIMIT_AUTH.windowMs);

// General API routes: 100 req / min
export const apiLimiter = createLimiter(RATE_LIMIT_API.max, RATE_LIMIT_API.windowMs);

// AI routes: 20 req / min — expensive operations
export const aiLimiter = createLimiter(RATE_LIMIT_AI.max, RATE_LIMIT_AI.windowMs);
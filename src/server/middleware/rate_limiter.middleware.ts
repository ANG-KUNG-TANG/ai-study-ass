import type { NextRequest } from "next/server";

import { RateLimitError } from "@/server/utils/errors";
import {
  RATE_LIMIT_AUTH,
  RATE_LIMIT_AI,
  RATE_LIMIT_API,
} from "@/server/utils/constants";
import { logActivity } from "@/server/services/auditLog.service";
import { checkRateLimit } from "@/server/services/rate-limit.service";

function getIP(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "anonymous";
  }

  return (
    req.headers.get("x-real-ip") ??
    (process.env.NODE_ENV === "production"
      ? "anonymous"
      : "dev-local")
  );
}

function createLimiter(
  limit: number,
  windowMs: number,
) {
  return async function applyLimit(
    req: NextRequest | Request,
    identifier: string,
  ): Promise<void> {
    if (!identifier.trim()) {
      throw new Error("Rate limiter identifier is required");
    }

    const ip = getIP(req);
    const key = `ai-study:rate:${identifier}:${ip}`;

    const result = await checkRateLimit({
      key,
      limit,
      windowMs,
    });

    if (result.allowed) {
      return;
    }

    const route = new URL(req.url).pathname;

    void logActivity({
      actorId: null,
      actorEmail: null,
      action: "rate_limit.hit",
      metadata: {
        route,
        ip,
        identifier,
        source: result.source,
      },
    });

    throw new RateLimitError(
      `Too many requests — try again in ${Math.ceil(
        result.retryAfterMs / 1_000,
      )} seconds`,
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

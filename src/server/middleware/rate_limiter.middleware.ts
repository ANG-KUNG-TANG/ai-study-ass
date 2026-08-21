import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";

import { getRedisClient } from "@/server/config/redis";
import { RateLimitError } from "@/server/utils/errors";
import {
  RATE_LIMIT_AUTH,
  RATE_LIMIT_AI,
  RATE_LIMIT_API,
} from "@/server/utils/constants";
import { logActivity } from "@/server/services/auditLog.service";
import { logger } from "@/server/utils/logger";

const REDIS_SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - window

redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)

local count = redis.call("ZCARD", key)

if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local oldestScore = now

  if oldest[2] then
    oldestScore = tonumber(oldest[2])
  end

  local retryAfter = math.max(1, oldestScore + window - now)
  redis.call("PEXPIRE", key, window)

  return {0, retryAfter}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)

return {1, 0}
`;

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

function getIP(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "anonymous";
  }

  return (
    req.headers.get("x-real-ip") ??
    (process.env.NODE_ENV === "production" ? "anonymous" : "dev-local")
  );
}

function normaliseRedisResult(result: unknown): RateLimitResult {
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Unexpected Redis rate-limit response");
  }

  const allowed = Number(result[0]) === 1;
  const retryAfterMs = Math.max(0, Number(result[1]) || 0);

  return {
    allowed,
    retryAfterMs,
  };
}

async function checkSlidingWindow(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  const now = Date.now();
  const member = `${now}:${randomUUID()}`;

  const result = await client.eval(
    REDIS_SLIDING_WINDOW_SCRIPT,
    {
      keys: [key],
      arguments: [
        String(now),
        String(windowMs),
        String(limit),
        member,
      ],
    },
  );

  return normaliseRedisResult(result);
}

function createLimiter(limit: number, windowMs: number) {
  return async function applyLimit(
    req: NextRequest | Request,
    identifier: string,
  ): Promise<void> {
    if (!identifier.trim()) {
      throw new Error("Rate limiter identifier is required");
    }

    const ip = getIP(req);
    const key = `rate-limit:v1:${identifier}:${ip}`;

    let result: RateLimitResult;

    try {
      result = await checkSlidingWindow(
        key,
        limit,
        windowMs,
      );
    } catch (error) {
      logger.error("[rate-limit] Redis check failed", {
        identifier,
        ip,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      throw error;
    }

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

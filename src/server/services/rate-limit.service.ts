import { randomUUID } from "node:crypto";

import { getRedisClient } from "@/server/config/redis";
import { logger } from "@/server/utils/logger";

export interface RateLimitCheckInput {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
  source: "redis" | "memory-fallback";
}

interface LocalRateLimitGlobal {
  __aiStudyRateLimitFallback?: Map<string, number[]>;
}

const localGlobal = globalThis as typeof globalThis & LocalRateLimitGlobal;
const localStore =
  localGlobal.__aiStudyRateLimitFallback ??
  new Map<string, number[]>();
localGlobal.__aiStudyRateLimitFallback = localStore;

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local count = redis.call('ZCARD', key)

if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window

  if oldest[2] then
    retry = math.max(1, tonumber(oldest[2]) + window - now)
  end

  redis.call('PEXPIRE', key, window)
  return {0, retry, 0}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)

return {1, 0, max - count - 1}
`;

function localFallback(
  input: RateLimitCheckInput,
): RateLimitCheckResult {
  const now = Date.now();
  const cutoff = now - input.windowMs;
  const timestamps = (localStore.get(input.key) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (timestamps.length >= input.limit) {
    const retryAfterMs = Math.max(
      1,
      timestamps[0] + input.windowMs - now,
    );

    localStore.set(input.key, timestamps);

    return {
      allowed: false,
      retryAfterMs,
      remaining: 0,
      source: "memory-fallback",
    };
  }

  timestamps.push(now);
  localStore.set(input.key, timestamps);

  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, input.limit - timestamps.length),
    source: "memory-fallback",
  };
}

function parseRedisResult(value: unknown): {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
} {
  if (!Array.isArray(value) || value.length < 3) {
    throw new Error("Unexpected Redis rate-limit response");
  }

  const allowed = Number(value[0]) === 1;
  const retryAfterMs = Math.max(0, Number(value[1]) || 0);
  const remaining = Math.max(0, Number(value[2]) || 0);

  return {
    allowed,
    retryAfterMs,
    remaining,
  };
}

export async function checkRateLimit(
  input: RateLimitCheckInput,
): Promise<RateLimitCheckResult> {
  if (!input.key.trim()) {
    throw new Error("Rate limiter key is required");
  }

  if (input.limit <= 0 || input.windowMs <= 0) {
    throw new Error("Rate limiter limit/window must be positive");
  }

  try {
    const client = await getRedisClient();
    const now = Date.now();

    const raw = await client.eval(
      SLIDING_WINDOW_LUA,
      {
        keys: [input.key],
        arguments: [
          String(now),
          String(input.windowMs),
          String(input.limit),
          `${now}-${randomUUID()}`,
        ],
      },
    );

    const result = parseRedisResult(raw);

    return {
      ...result,
      source: "redis",
    };
  } catch (error) {
    logger.warn("[rate-limit] Redis unavailable; using memory fallback", {
      key: input.key,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return localFallback(input);
  }
}

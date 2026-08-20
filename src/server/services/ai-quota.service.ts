import {
  AI_CONFIG,
} from "@/server/config/ai_config";

import * as aiUsageRepo from "@/server/repositories/ai-usage.repo";

export type AIUserQuotaKind =
  | "requests"
  | "tokens";

export interface UserAIQuotaSnapshot {
  enabled: boolean;

  requestLimit: number | null;
  tokenLimit: number | null;

  requestsUsed: number;
  tokensUsed: number;

  requestsRemaining: number | null;
  tokensRemaining: number | null;

  requestLimitReached: boolean;
  tokenLimitReached: boolean;

  allowed: boolean;

  resetsAt: Date;
}

export class AIUserQuotaError extends Error {
  readonly code =
    "AI_USER_QUOTA_EXCEEDED";

  readonly kind:
    AIUserQuotaKind;

  readonly limit:
    number;

  readonly used:
    number;

  constructor(
    kind: AIUserQuotaKind,
    limit: number,
    used: number,
  ) {
    const unit =
      kind === "requests"
        ? "provider request"
        : "provider token";

    super(
      `Daily AI ${unit} limit reached. ` +
        "Symbolic study features remain available.",
    );

    this.name =
      "AIUserQuotaError";

    this.kind =
      kind;

    this.limit =
      limit;

    this.used =
      used;
  }
}

function beginningOfUtcDay(
  date: Date,
): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

function nextUtcDay(
  date: Date,
): Date {
  const start =
    beginningOfUtcDay(date);

  return new Date(
    start.getTime() +
      86_400_000,
  );
}

function remaining(
  limit: number,
  used: number,
): number | null {
  if (limit <= 0) {
    return null;
  }

  return Math.max(
    0,
    limit - used,
  );
}

export function isUserAIQuotaEnabled():
boolean {
  return (
    AI_CONFIG
      .userDailyRequestLimit >
      0 ||
    AI_CONFIG
      .userDailyTokenLimit >
      0
  );
}

export async function getUserAIQuotaSnapshot(
  userId: string,
  now = new Date(),
): Promise<UserAIQuotaSnapshot> {
  const requestLimit =
    AI_CONFIG
      .userDailyRequestLimit;

  const tokenLimit =
    AI_CONFIG
      .userDailyTokenLimit;

  const since =
    beginningOfUtcDay(now);

  const totals =
    await aiUsageRepo
      .getUserTotalsSince(
        userId,
        since,
      );

  const requestLimitReached =
    requestLimit > 0 &&
    totals.requests >=
      requestLimit;

  const tokenLimitReached =
    tokenLimit > 0 &&
    totals.tokens >=
      tokenLimit;

  return {
    enabled:
      requestLimit > 0 ||
      tokenLimit > 0,

    requestLimit:
      requestLimit > 0
        ? requestLimit
        : null,

    tokenLimit:
      tokenLimit > 0
        ? tokenLimit
        : null,

    requestsUsed:
      totals.requests,

    tokensUsed:
      totals.tokens,

    requestsRemaining:
      remaining(
        requestLimit,
        totals.requests,
      ),

    tokensRemaining:
      remaining(
        tokenLimit,
        totals.tokens,
      ),

    requestLimitReached,

    tokenLimitReached,

    allowed:
      !requestLimitReached &&
      !tokenLimitReached,

    resetsAt:
      nextUtcDay(now),
  };
}

/**
 * Called by the central AI gateway before a real provider call.
 *
 * Unlimited-by-default:
 * if both limits are zero, no database query is performed.
 */
export async function assertUserAIQuota(
  userId: string,
): Promise<void> {
  if (
    !isUserAIQuotaEnabled()
  ) {
    return;
  }

  const snapshot =
    await getUserAIQuotaSnapshot(
      userId,
    );

  if (
    snapshot.requestLimitReached &&
    snapshot.requestLimit !== null
  ) {
    throw new AIUserQuotaError(
      "requests",
      snapshot.requestLimit,
      snapshot.requestsUsed,
    );
  }

  if (
    snapshot.tokenLimitReached &&
    snapshot.tokenLimit !== null
  ) {
    throw new AIUserQuotaError(
      "tokens",
      snapshot.tokenLimit,
      snapshot.tokensUsed,
    );
  }
}

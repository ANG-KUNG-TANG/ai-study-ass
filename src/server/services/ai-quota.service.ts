import {
  AI_CONFIG,
} from "@/server/config/ai_config";

import * as aiUsageRepo from "@/server/repositories/ai-usage.repo";
import * as userAIPolicyRepo from "@/server/repositories/user-ai-policy.repo";

export type AIUserQuotaKind =
  | "requests"
  | "tokens";

export interface UserAIQuotaSnapshot {
  enabled: boolean;
  providerAccessEnabled: boolean;
  source: "system_default" | "user_override";

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

export class AIUserAccessDisabledError extends Error {
  readonly code = "AI_USER_ACCESS_DISABLED";

  constructor() {
    super(
      "AI provider access has been disabled for this account. Symbolic study features remain available.",
    );
    this.name = "AIUserAccessDisabledError";
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
    AI_CONFIG.userDailyRequestLimit;

  const tokenLimit = AI_CONFIG.userDailyTokenLimit;

  const policy = await userAIPolicyRepo.findByUserId(userId);
  const effectiveRequestLimit = policy
    ? policy.toPublic().dailyRequestLimit ?? requestLimit
    : requestLimit;
  const effectiveTokenLimit = policy
    ? policy.toPublic().dailyTokenLimit ?? tokenLimit
    : tokenLimit;
  const providerAccessEnabled = policy?.toPublic().enabled ?? true;

  const since =
    beginningOfUtcDay(now);

  const totals =
    await aiUsageRepo
      .getUserTotalsSince(
        userId,
        since,
      );

  const requestLimitReached =
    effectiveRequestLimit > 0 &&
    totals.requests >=
      effectiveRequestLimit;

  const tokenLimitReached =
    effectiveTokenLimit > 0 &&
    totals.tokens >=
      effectiveTokenLimit;

  return {
    enabled:
      effectiveRequestLimit > 0 ||
      effectiveTokenLimit > 0,

    providerAccessEnabled,
    source: policy ? "user_override" : "system_default",

    requestLimit:
      effectiveRequestLimit > 0
        ? effectiveRequestLimit
        : null,

    tokenLimit:
      effectiveTokenLimit > 0
        ? effectiveTokenLimit
        : null,

    requestsUsed:
      totals.requests,

    tokensUsed:
      totals.tokens,

    requestsRemaining:
      remaining(
        effectiveRequestLimit,
        totals.requests,
      ),

    tokensRemaining:
      remaining(
        effectiveTokenLimit,
        totals.tokens,
      ),

    requestLimitReached,

    tokenLimitReached,

    allowed:
      providerAccessEnabled &&
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
  const snapshot =
    await getUserAIQuotaSnapshot(
      userId,
    );

  if (!snapshot.providerAccessEnabled) {
    throw new AIUserAccessDisabledError();
  }

  if (!snapshot.enabled && !isUserAIQuotaEnabled()) {
    return;
  }

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

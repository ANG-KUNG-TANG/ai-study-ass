import { randomUUID } from "crypto";

import {
  AIUsageEntity,
  type AIUsageProvider,
  type AIUsageProps,
} from "@/server/entities/ai-usage.entity";

import * as aiUsageRepo from "@/server/repositories/ai-usage.repo";

import { logger } from "@/server/utils/logger";

export interface RecordAIUsageInput {
  userId?: string | null;
  noteId?: string | null;

  provider: AIUsageProvider;
  model: string;
  usageLabel: string;

  success: boolean;

  tokensUsed: number;
  latencyMs: number;

  statusCode?: number | null;
  quotaExceeded?: boolean;
}

/**
 * Usage telemetry must never cause an otherwise valid
 * AI generation request to fail.
 *
 * We still await the DB write so successful telemetry
 * is durable before the request lifecycle completes.
 */
export async function recordAIUsage(
  input: RecordAIUsageInput,
): Promise<void> {
  try {
    const entity =
      AIUsageEntity.create({
        id: randomUUID(),

        userId:
          input.userId ?? null,

        noteId:
          input.noteId ?? null,

        provider: input.provider,
        model: input.model,
        usageLabel:
          input.usageLabel,

        success:
          input.success,

        tokensUsed:
          input.tokensUsed,

        latencyMs:
          input.latencyMs,

        statusCode:
          input.statusCode ?? null,

        quotaExceeded:
          input.quotaExceeded ?? false,
      });

    await aiUsageRepo.create(entity);
  } catch (error) {
    logger.warn(
      "[ai-usage] failed to persist usage telemetry",
      {
        provider: input.provider,
        usageLabel:
          input.usageLabel,
        userId:
          input.userId ?? null,
        noteId:
          input.noteId ?? null,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
  }
}

export async function getUsageSince(
  since: Date,
): Promise<AIUsageProps[]> {
  const events =
    await aiUsageRepo.findSince(since);

  return events.map(
    (event) =>
      event.toPublic(),
  );
}

export async function getUserUsageSince(
  userId: string,
  since: Date,
): Promise<AIUsageProps[]> {
  const events =
    await aiUsageRepo.findByUserIdSince(
      userId,
      since,
    );

  return events.map(
    (event) =>
      event.toPublic(),
  );
}

export interface StudentAIUsageSummary {
  summary: {
    requestsToday: number;
    successesToday: number;
    failuresToday: number;
    tokensToday: number;
    averageLatencyMs: number;
    successRate: number;
    quotaExceededToday: number;
  };

  providers: Array<{
    provider: AIUsageProvider;
    requests: number;
    successes: number;
    failures: number;
    tokens: number;
    averageLatencyMs: number;
  }>;

  features: Array<{
    label: string;
    requests: number;
    successes: number;
    failures: number;
    tokens: number;
  }>;

  lastSevenDays: Array<{
    date: string;
    label: string;
    requests: number;
    tokens: number;
  }>;

  recentActivity: Array<{
    id: string;
    noteId: string | null;
    provider: AIUsageProvider;
    model: string;
    usageLabel: string;
    success: boolean;
    tokensUsed: number;
    latencyMs: number;
    statusCode: number | null;
    quotaExceeded: boolean;
    createdAt: string;
  }>;
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

function averageUsageNumber(
  values: number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length,
  );
}

export async function getUserAIUsageSummary(
  userId: string,
): Promise<StudentAIUsageSummary> {
  const now = new Date();
  const today =
    beginningOfUtcDay(now);

  const sevenDaysStart =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 6,
      ),
    );

  const events =
    await getUserUsageSince(
      userId,
      sevenDaysStart,
    );

  const todayEvents =
    events.filter(
      (event) =>
        event.createdAt >= today,
    );

  const successesToday =
    todayEvents.filter(
      (event) =>
        event.success,
    );

  const failuresToday =
    todayEvents.filter(
      (event) =>
        !event.success,
    );

  const providers:
    AIUsageProvider[] = [
      "openai",
      "gemini",
    ];

  const providerUsage =
    providers.map(
      (provider) => {
        const providerEvents =
          events.filter(
            (event) =>
              event.provider ===
              provider,
          );

        return {
          provider,

          requests:
            providerEvents.length,

          successes:
            providerEvents.filter(
              (event) =>
                event.success,
            ).length,

          failures:
            providerEvents.filter(
              (event) =>
                !event.success,
            ).length,

          tokens:
            providerEvents.reduce(
              (sum, event) =>
                sum +
                event.tokensUsed,
              0,
            ),

          averageLatencyMs:
            averageUsageNumber(
              providerEvents.map(
                (event) =>
                  event.latencyMs,
              ),
            ),
        };
      },
    );

  const featureMap =
    new Map<
      string,
      {
        label: string;
        requests: number;
        successes: number;
        failures: number;
        tokens: number;
      }
    >();

  for (
    const event of events
  ) {
    const current =
      featureMap.get(
        event.usageLabel,
      ) ?? {
        label:
          event.usageLabel,
        requests: 0,
        successes: 0,
        failures: 0,
        tokens: 0,
      };

    current.requests += 1;
    current.tokens +=
      event.tokensUsed;

    if (event.success) {
      current.successes += 1;
    } else {
      current.failures += 1;
    }

    featureMap.set(
      event.usageLabel,
      current,
    );
  }

  const weekday =
    new Intl.DateTimeFormat(
      "en",
      {
        weekday: "short",
        timeZone: "UTC",
      },
    );

  const lastSevenDays =
    Array.from(
      {
        length: 7,
      },
      (_, index) => {
        const day =
          new Date(
            Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate() -
                (6 - index),
            ),
          );

        const nextDay =
          new Date(
            day.getTime() +
              86_400_000,
          );

        const dayEvents =
          events.filter(
            (event) =>
              event.createdAt >=
                day &&
              event.createdAt <
                nextDay,
          );

        return {
          date:
            day
              .toISOString()
              .slice(0, 10),

          label:
            weekday.format(day),

          requests:
            dayEvents.length,

          tokens:
            dayEvents.reduce(
              (sum, event) =>
                sum +
                event.tokensUsed,
              0,
            ),
        };
      },
    );

  return {
    summary: {
      requestsToday:
        todayEvents.length,

      successesToday:
        successesToday.length,

      failuresToday:
        failuresToday.length,

      tokensToday:
        todayEvents.reduce(
          (sum, event) =>
            sum +
            event.tokensUsed,
          0,
        ),

      averageLatencyMs:
        averageUsageNumber(
          todayEvents.map(
            (event) =>
              event.latencyMs,
          ),
        ),

      successRate:
        todayEvents.length ===
        0
          ? 0
          : (
              successesToday.length /
              todayEvents.length
            ) *
            100,

      quotaExceededToday:
        todayEvents.filter(
          (event) =>
            event.quotaExceeded,
        ).length,
    },

    providers:
      providerUsage,

    features:
      Array.from(
        featureMap.values(),
      ).sort(
        (left, right) =>
          right.requests -
          left.requests,
      ),

    lastSevenDays,

    recentActivity:
      [...events]
        .sort(
          (left, right) =>
            right.createdAt.getTime() -
            left.createdAt.getTime(),
        )
        .slice(0, 20)
        .map(
          (event) => ({
            id: event.id,
            noteId:
              event.noteId,
            provider:
              event.provider,
            model:
              event.model,
            usageLabel:
              event.usageLabel,
            success:
              event.success,
            tokensUsed:
              event.tokensUsed,
            latencyMs:
              event.latencyMs,
            statusCode:
              event.statusCode,
            quotaExceeded:
              event.quotaExceeded,
            createdAt:
              event.createdAt.toISOString(),
          }),
        ),
  };
}

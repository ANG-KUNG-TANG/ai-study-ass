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

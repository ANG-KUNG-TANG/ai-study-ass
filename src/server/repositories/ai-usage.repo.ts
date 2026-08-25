import {
  AIUsage,
  type AIUsagePersistence,
} from "@/server/models/AIUsage";

import {
  AIUsageEntity,
} from "@/server/entities/ai-usage.entity";

type AIUsageRecord = AIUsagePersistence;

function toEntity(
  doc: AIUsageRecord,
): AIUsageEntity {
  return AIUsageEntity.fromPersistence({
    id: String(doc._id),

    userId:
      doc.userId
        ? String(doc.userId)
        : null,

    noteId:
      doc.noteId
        ? String(doc.noteId)
        : null,

    provider: doc.provider,
    model: doc.model,
    usageLabel: doc.usageLabel,

    success: doc.success,

    tokensUsed:
      doc.tokensUsed ?? 0,

    inputTokens:
      doc.inputTokens ?? 0,

    outputTokens:
      doc.outputTokens ?? 0,

    estimatedCostUsd:
      doc.estimatedCostUsd ?? 0,

    latencyMs:
      doc.latencyMs ?? 0,

    statusCode:
      doc.statusCode ?? null,

    quotaExceeded:
      doc.quotaExceeded ?? false,

    createdAt:
      doc.createdAt ?? new Date(),
  });
}

export async function create(
  entity: AIUsageEntity,
): Promise<AIUsageEntity> {
  const data =
    entity.toPersistence();

  const document =
    await AIUsage.create({
      _id: data.id,

      userId: data.userId,
      noteId: data.noteId,

      provider: data.provider,
      model: data.model,
      usageLabel: data.usageLabel,

      success: data.success,

      tokensUsed: data.tokensUsed,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      estimatedCostUsd: data.estimatedCostUsd,
      latencyMs: data.latencyMs,

      statusCode: data.statusCode,
      quotaExceeded: data.quotaExceeded,

      createdAt: data.createdAt,
    });

  return toEntity(
    document.toObject() as AIUsageRecord,
  );
}

export async function findSince(
  since: Date,
): Promise<AIUsageEntity[]> {
  const docs =
    await AIUsage.find({
      createdAt: {
        $gte: since,
      },
    })
      .sort({
        createdAt: 1,
      })
      .lean<AIUsageRecord[]>()
      .exec();

  return docs.map(toEntity);
}

export async function findByUserIdSince(
  userId: string,
  since: Date,
): Promise<AIUsageEntity[]> {
  const docs =
    await AIUsage.find({
      userId,
      createdAt: {
        $gte: since,
      },
    })
      .sort({
        createdAt: 1,
      })
      .lean<AIUsageRecord[]>()
      .exec();

  return docs.map(toEntity);
}

export async function deleteByUserId(
  userId: string,
): Promise<void> {
  await AIUsage.deleteMany({
    userId,
  }).exec();
}

export async function findByNoteId(
  noteId: string,
  limit: number = 50,
): Promise<AIUsageEntity[]> {
  const docs = await AIUsage.find({ noteId })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Math.floor(limit))))
    .lean<AIUsageRecord[]>()
    .exec();

  return docs.map(toEntity);
}

export interface AIUsageTotals {
  requests: number;
  tokens: number;
}

export async function getUserTotalsSince(
  userId: string,
  since: Date,
): Promise<AIUsageTotals> {
  const result =
    await AIUsage.aggregate<{
      requests: number;
      tokens: number;
    }>([
      {
        $match: {
          userId,
          createdAt: {
            $gte: since,
          },
        },
      },
      {
        $group: {
          _id: null,
          requests: {
            $sum: 1,
          },
          tokens: {
            $sum: "$tokensUsed",
          },
        },
      },
    ]).exec();

  return {
    requests:
      result[0]?.requests ??
      0,

    tokens:
      result[0]?.tokens ??
      0,
  };
}

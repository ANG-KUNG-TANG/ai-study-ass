import { getRedisClient } from "@/server/config/redis";
import { logger } from "@/server/utils/logger";
import {
  GENERATION_FEATURES,
  type FeatureGenerationState,
  type GenerationFeature,
  type StudyGenerationState,
} from "@/server/types/generation";

const CACHE_PREFIX = "ai-study:note";
const GENERATION_STATUS_TTL_SECONDS = 20;

function cacheKey(noteId: string): string {
  return `${CACHE_PREFIX}:${noteId}:generation`;
}

function toDate(value: unknown): Date {
  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid cached generation timestamp");
  }

  return date;
}

function reviveFeature(
  value: unknown,
): FeatureGenerationState {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid cached generation feature");
  }

  const feature = value as Record<string, unknown>;

  return {
    status: feature.status as FeatureGenerationState["status"],
    source: feature.source as FeatureGenerationState["source"],
    confidence:
      typeof feature.confidence === "number"
        ? feature.confidence
        : null,
    aiFallbackUsed: Boolean(feature.aiFallbackUsed),
    itemCount:
      typeof feature.itemCount === "number"
        ? feature.itemCount
        : null,
    error:
      typeof feature.error === "string"
        ? feature.error
        : null,
    updatedAt: toDate(feature.updatedAt),
  };
}

function parseCachedState(
  raw: string,
): StudyGenerationState {
  const value = JSON.parse(raw) as Record<string, unknown>;

  if (
    !value ||
    typeof value !== "object" ||
    typeof value.noteId !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.stage !== "string" ||
    !value.features ||
    typeof value.features !== "object"
  ) {
    throw new Error("Invalid cached generation state");
  }

  const rawFeatures = value.features as Record<string, unknown>;
  const features = {} as Record<
    GenerationFeature,
    FeatureGenerationState
  >;

  for (const feature of GENERATION_FEATURES) {
    features[feature] = reviveFeature(rawFeatures[feature]);
  }

  return {
    noteId: value.noteId,
    userId: value.userId,
    stage: value.stage as StudyGenerationState["stage"],
    features,
    startedAt: toDate(value.startedAt),
    completedAt:
      value.completedAt == null
        ? null
        : toDate(value.completedAt),
    createdAt: toDate(value.createdAt),
    updatedAt: toDate(value.updatedAt),
  };
}

export async function getGenerationStatusFromCache(
  noteId: string,
): Promise<StudyGenerationState | null> {
  try {
    const client = await getRedisClient();
    const raw = await client.get(cacheKey(noteId));

    if (!raw) {
      return null;
    }

    try {
      return parseCachedState(raw);
    } catch (error) {
      // Corrupt/stale cache data must never break the authoritative Mongo path.
      await client.del(cacheKey(noteId));

      logger.warn("[cache] invalid generation status removed", {
        noteId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      return null;
    }
  } catch (error) {
    // Redis is an optimisation. MongoDB remains the source of truth.
    logger.warn("[cache] generation status read failed", {
      noteId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return null;
  }
}

export async function setGenerationStatusCache(
  noteId: string,
  state: StudyGenerationState,
): Promise<void> {
  try {
    const client = await getRedisClient();

    await client.set(
      cacheKey(noteId),
      JSON.stringify(state),
      {
        EX: GENERATION_STATUS_TTL_SECONDS,
      },
    );
  } catch (error) {
    logger.warn("[cache] generation status write failed", {
      noteId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

export async function invalidateGenerationStatusCache(
  noteId: string,
): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(cacheKey(noteId));
  } catch (error) {
    logger.warn("[cache] generation status invalidation failed", {
      noteId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

export function getGenerationStatusCacheKey(
  noteId: string,
): string {
  return cacheKey(noteId);
}

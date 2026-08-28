import {
  createHash,
} from "crypto";

import * as repairCacheRepo from "@/server/repositories/repair-cache.repo";
import type {
  RepairCacheDescriptor,
  RepairFeature,
} from "@/server/types/repair";
import { logger } from "@/server/utils/logger";

const REPAIR_CACHE_TTL_MS =
  30 * 24 * 60 * 60 * 1_000;

const MAX_REPAIR_PAYLOAD_BYTES =
  64 * 1_024;

function hash(
  value: string,
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function normaliseParts(
  values: readonly string[],
): string {
  return [...values]
    .map((value) =>
      value
        .normalize("NFKC")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .filter(Boolean)
    .sort()
    .join("\n");
}

export function buildRepairCacheDescriptor(
  input: {
    noteId: string;
    userId: string;
    feature: RepairFeature;
    sourceText: string;
    variant: string;
    gapParts: readonly string[];
    strategyVersion: string;
  },
): RepairCacheDescriptor {
  const sourceFingerprint =
    hash(input.sourceText);
  const variantFingerprint =
    hash(
      input.variant
        .normalize("NFKC")
        .trim(),
    );
  const gapFingerprint =
    hash(
      normaliseParts(
        input.gapParts,
      ),
    );

  const key = hash(
    [
      input.feature,
      sourceFingerprint,
      variantFingerprint,
      gapFingerprint,
      input.strategyVersion,
    ].join("\u0000"),
  );

  return {
    key,
    noteId: input.noteId,
    userId: input.userId,
    feature: input.feature,
    sourceFingerprint,
    variantFingerprint,
    gapFingerprint,
    strategyVersion:
      input.strategyVersion,
  };
}

function descriptorMatches(
  descriptor: RepairCacheDescriptor,
  cached: {
    noteId: string;
    userId: string;
    feature: RepairFeature;
    sourceFingerprint: string;
    variantFingerprint: string;
    gapFingerprint: string;
    strategyVersion: string;
  },
): boolean {
  return (
    cached.noteId ===
      descriptor.noteId &&
    cached.userId ===
      descriptor.userId &&
    cached.feature ===
      descriptor.feature &&
    cached.sourceFingerprint ===
      descriptor.sourceFingerprint &&
    cached.variantFingerprint ===
      descriptor.variantFingerprint &&
    cached.gapFingerprint ===
      descriptor.gapFingerprint &&
    cached.strategyVersion ===
      descriptor.strategyVersion
  );
}

export async function getCachedRepair<T>(
  descriptor: RepairCacheDescriptor,
): Promise<T | null> {
  try {
    const cached =
      await repairCacheRepo.findById(
        descriptor.key,
      );

    if (!cached) {
      return null;
    }

    if (
      cached.expiresAt.getTime() <=
        Date.now() ||
      !descriptorMatches(
        descriptor,
        cached,
      )
    ) {
      await repairCacheRepo.deleteById(
        descriptor.key,
      );
      return null;
    }

    return cached.payload as T;
  } catch (error) {
    logger.warn(
      "[repair-cache] read failed; continuing without cache",
      {
        feature:
          descriptor.feature,
        noteId:
          descriptor.noteId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
    return null;
  }
}

export async function saveCachedRepair(
  descriptor: RepairCacheDescriptor,
  payload: unknown,
): Promise<void> {
  try {
    const serialised =
      JSON.stringify(payload);

    if (
      Buffer.byteLength(
        serialised,
        "utf8",
      ) >
      MAX_REPAIR_PAYLOAD_BYTES
    ) {
      logger.warn(
        "[repair-cache] validated repair was too large to cache",
        {
          feature:
            descriptor.feature,
          noteId:
            descriptor.noteId,
        },
      );
      return;
    }

    await repairCacheRepo.upsert({
      _id: descriptor.key,
      noteId:
        descriptor.noteId,
      userId:
        descriptor.userId,
      feature:
        descriptor.feature,
      sourceFingerprint:
        descriptor.sourceFingerprint,
      variantFingerprint:
        descriptor.variantFingerprint,
      gapFingerprint:
        descriptor.gapFingerprint,
      strategyVersion:
        descriptor.strategyVersion,
      payload,
      expiresAt:
        new Date(
          Date.now() +
            REPAIR_CACHE_TTL_MS,
        ),
    });
  } catch (error) {
    logger.warn(
      "[repair-cache] write failed; generated result remains usable",
      {
        feature:
          descriptor.feature,
        noteId:
          descriptor.noteId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
  }
}

export async function invalidateCachedRepair(
  descriptor: RepairCacheDescriptor,
): Promise<void> {
  try {
    await repairCacheRepo.deleteById(
      descriptor.key,
    );
  } catch (error) {
    logger.warn(
      "[repair-cache] invalidation failed",
      {
        feature:
          descriptor.feature,
        noteId:
          descriptor.noteId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
  }
}

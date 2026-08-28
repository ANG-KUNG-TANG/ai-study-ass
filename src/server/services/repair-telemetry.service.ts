import {
  randomUUID,
} from "crypto";

import * as repairTelemetryRepo from "@/server/repositories/repair-telemetry.repo";
import type {
  RepairTelemetryInput,
} from "@/server/types/repair";
import { logger } from "@/server/utils/logger";

function nonNegativeInteger(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(value),
  );
}

export async function recordRepairTelemetry(
  input: RepairTelemetryInput,
): Promise<void> {
  try {
    await repairTelemetryRepo.create({
      _id: randomUUID(),
      noteId:
        input.noteId,
      userId:
        input.userId,
      feature:
        input.feature,
      strategyVersion:
        input.strategyVersion,
      repairNeeded:
        input.repairNeeded,
      repairAttempted:
        input.repairAttempted,
      repairCacheHit:
        input.repairCacheHit,
      repairAccepted:
        input.repairAccepted,
      providerCallAvoided:
        input.providerCallAvoided,
      evidenceCharacters:
        nonNegativeInteger(
          input.evidenceCharacters,
        ),
      tokensUsed:
        nonNegativeInteger(
          input.tokensUsed,
        ),
      gapCodes:
        [...new Set(
          input.gapCodes
            .map((value) =>
              value
                .normalize("NFKC")
                .trim(),
            )
            .filter(Boolean),
        )].slice(0, 20),
      createdAt:
        new Date(),
    });

    logger.info(
      "[repair-telemetry] repair decision recorded",
      {
        noteId:
          input.noteId,
        feature:
          input.feature,
        repairNeeded:
          input.repairNeeded,
        repairAttempted:
          input.repairAttempted,
        repairCacheHit:
          input.repairCacheHit,
        repairAccepted:
          input.repairAccepted,
        providerCallAvoided:
          input.providerCallAvoided,
        evidenceCharacters:
          nonNegativeInteger(
            input.evidenceCharacters,
          ),
        tokensUsed:
          nonNegativeInteger(
            input.tokensUsed,
          ),
      },
    );
  } catch (error) {
    logger.warn(
      "[repair-telemetry] failed to persist repair telemetry",
      {
        noteId:
          input.noteId,
        feature:
          input.feature,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
  }
}

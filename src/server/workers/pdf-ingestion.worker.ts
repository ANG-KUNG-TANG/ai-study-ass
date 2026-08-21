import { Worker, type Job, UnrecoverableError } from "bullmq";

import IORedis from "ioredis";

import {
  PDF_INGESTION_JOB_NAME,
  PDF_INGESTION_QUEUE_NAME,
  type PdfIngestionJobData,
  type PdfIngestionJobResult,
} from "@/server/queues/pdf-ingestion.queue";

import { connectDb, disconnectDB } from "@/server/config/database";

import * as noteRepo from "@/server/repositories/note.repo";

import * as generationRepo from "@/server/repositories/study-generation.repo";

import { processUpload } from "@/server/services/upload.service";

import {
  readTemporaryUpload,
  deleteTemporaryUpload,
} from "@/server/services/document-storage.service";

import { enqueueStudyGeneration } from "@/server/queues/study-generation.queue";

import { logger } from "@/server/utils/logger";
import { startWorkerHeartbeat } from "@/server/services/system-health.service";
import {
  classifyProviderFailure,
  PDF_OCR_QUOTA_EXHAUSTED_PREFIX,
} from "@/server/utils/provider-error";

// ─────────────────────────────────────────────────────────────────────────────
// Redis
// ─────────────────────────────────────────────────────────────────────────────

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency
// ─────────────────────────────────────────────────────────────────────────────

function getConcurrency(): number {
  const parsed = Number.parseInt(process.env.PDF_WORKER_CONCURRENCY ?? "1", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  /**
   * Vision OCR is expensive.
   *
   * Keep this deliberately conservative.
   */
  return Math.min(parsed, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress
// ─────────────────────────────────────────────────────────────────────────────

interface PdfJobProgress {
  stage: "vision-ocr" | "ocr-complete" | "generation-queued";
}

function hasCompletedOcr(
  job: Job<PdfIngestionJobData, PdfIngestionJobResult>,
): boolean {
  const progress = job.progress;

  if (!progress || typeof progress !== "object") {
    return false;
  }

  const value = progress as Partial<PdfJobProgress>;

  return value.stage === "ocr-complete" || value.stage === "generation-queued";
}

// ─────────────────────────────────────────────────────────────────────────────
// Processor
// ─────────────────────────────────────────────────────────────────────────────

async function processPdfIngestionJob(
  job: Job<PdfIngestionJobData, PdfIngestionJobResult>,
): Promise<PdfIngestionJobResult> {
  if (job.name !== PDF_INGESTION_JOB_NAME) {
    throw new Error(`Unsupported PDF ingestion job: ${job.name}`);
  }

  const { noteId, userId, storageKey, telegramChatId } = job.data;

  logger.info("[pdf-worker] ingestion started", {
    jobId: job.id,

    noteId,

    userId,

    attempt: job.attemptsMade + 1,

    storageKey,
  });

  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new Error("PDF ingestion user does not own this note");
  }

  let pageCount = 0;

  let charCount = note.content.length;

  let visionUsed = true;

  // ─────────────────────────────────────────────────────────────
  // OCR stage
  //
  // If OCR already completed in an earlier attempt,
  // do NOT spend Gemini quota doing it again.
  // ─────────────────────────────────────────────────────────────

  if (!hasCompletedOcr(job)) {
    await generationRepo.updateStage(noteId, "vision_ocr");

    await job.updateProgress({
      stage: "vision-ocr",
    } satisfies PdfJobProgress);

    const buffer = await readTemporaryUpload(storageKey);

    /**
     * IMPORTANT:
     *
     * This uses the exact PDF pipeline we already
     * tested successfully:
     *
     * native extraction
     * → quality classification
     * → page selection
     * → rendering
     * → adaptive OCR batching
     * → reconstruction
     * → canonical content
     */
    let processed;

    try {
      processed = await processUpload(
        {
          buffer,

          originalName: note.fileName,

          mimeType: "application/pdf",

          size: note.fileSize,
        },
        {
          userId,
          noteId,
          usageLabel: "ocr",
        },
      );
    } catch (error) {
      const failure = classifyProviderFailure(error);

      // ───────────────────────────────────────────────────────────
      // Explicit quota exhaustion
      //
      // Do not waste attempt 2 and attempt 3.
      // Preserve the PDF so this exact job can be retried later.
      // ───────────────────────────────────────────────────────────

      if (failure.kind === "quota-exhausted") {
        logger.warn(
          "[pdf-worker] provider quota exhausted; stopping automatic retries",
          {
            jobId: job.id,

            noteId,

            providerFailure: failure.kind,

            statusCode: failure.statusCode,

            storageKey,
          },
        );

        throw new UnrecoverableError(
          `${PDF_OCR_QUOTA_EXHAUSTED_PREFIX}: ${failure.message}`,
        );
      }

      // 429 rate limits, 5xx and timeouts remain ordinary Errors.
      // BullMQ will apply the configured retry/backoff policy.
      throw error;
    }

    if (processed.fileType !== "pdf") {
      throw new Error("PDF ingestion worker received a non-PDF result");
    }

    if (!processed.content.trim()) {
      throw new Error("PDF OCR completed without readable content");
    }

    await noteRepo.updateContent(noteId, processed.content);

    pageCount = processed.pageCount ?? 0;

    charCount = processed.charCount;

    visionUsed = Boolean(processed.visionFallbackUsed);

    /**
     * This marker prevents unnecessary OCR
     * if enqueueStudyGeneration fails and
     * BullMQ retries this ingestion job.
     */
    await job.updateProgress({
      stage: "ocr-complete",
    } satisfies PdfJobProgress);

    logger.info("[pdf-worker] OCR completed", {
      jobId: job.id,

      noteId,

      pageCount,

      charCount,

      visionUsed,
    });
  } else {
    logger.info(
      "[pdf-worker] OCR already completed, skipping repeated vision processing",
      {
        jobId: job.id,

        noteId,
      },
    );

    const refreshedNote = await noteRepo.findByIdOrThrow(noteId);

    charCount = refreshedNote.content.length;
  }

  // ─────────────────────────────────────────────────────────────
  // Queue intelligence + feature generation
  // ─────────────────────────────────────────────────────────────

  await generationRepo.updateStage(noteId, "pending");

  await enqueueStudyGeneration({
    noteId,
    userId,
    telegramChatId,
  });

  await job.updateProgress({
    stage: "generation-queued",
  } satisfies PdfJobProgress);

  // ─────────────────────────────────────────────────────────────
  // Raw PDF is no longer needed.
  // ─────────────────────────────────────────────────────────────

  await deleteTemporaryUpload(storageKey);

  logger.info("[pdf-worker] ingestion completed", {
    jobId: job.id,

    noteId,

    charCount,

    generationQueued: true,
  });

  return {
    noteId,

    pageCount,

    charCount,

    visionUsed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Final failure
// ─────────────────────────────────────────────────────────────────────────────

async function handleJobFailure(
  job: Job<PdfIngestionJobData, PdfIngestionJobResult>,
  error: Error,
): Promise<void> {
  const failure = classifyProviderFailure(error);

  const maxAttempts =
    typeof job.opts.attempts === "number" ? job.opts.attempts : 1;

  const automaticAttemptsRemain = job.attemptsMade < maxAttempts;

  // ─────────────────────────────────────────────────────────────
  // Explicit quota exhaustion
  //
  // UnrecoverableError stops BullMQ immediately.
  // Mark UI state failed, but KEEP the original PDF.
  // ─────────────────────────────────────────────────────────────

  if (failure.kind === "quota-exhausted") {
    await generationRepo.updateStage(job.data.noteId, "ocr_failed");

    logger.warn(
      "[pdf-worker] PDF ingestion paused because provider quota is exhausted",
      {
        jobId: job.id,

        noteId: job.data.noteId,

        storageKey: job.data.storageKey,

        preservedUpload: true,
      },
    );

    return;
  }

  // ─────────────────────────────────────────────────────────────
  // Ordinary retryable errors
  //
  // Let BullMQ perform remaining retries.
  // ─────────────────────────────────────────────────────────────

  if (automaticAttemptsRemain) {
    return;
  }

  await generationRepo.updateStage(job.data.noteId, "ocr_failed");

  // ─────────────────────────────────────────────────────────────
  // Provider outage/rate limit still recoverable later.
  //
  // Preserve the PDF even after automatic attempts are exhausted.
  // ─────────────────────────────────────────────────────────────

  if (failure.preserveUpload) {
    logger.warn(
      "[pdf-worker] recoverable PDF ingestion failure; upload preserved for manual retry",
      {
        jobId: job.id,

        noteId: job.data.noteId,

        failureKind: failure.kind,

        statusCode: failure.statusCode,

        storageKey: job.data.storageKey,
      },
    );

    return;
  }

  // ─────────────────────────────────────────────────────────────
  // Real permanent/non-provider failure.
  //
  // Safe to clean up.
  // ─────────────────────────────────────────────────────────────

  await deleteTemporaryUpload(job.data.storageKey);

  logger.info("[pdf-worker] failed upload removed", {
    jobId: job.id,

    noteId: job.data.noteId,

    storageKey: job.data.storageKey,
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// Worker startup
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await connectDb();

  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,

    enableReadyCheck: true,
  });

  connection.on("error", (error) => {
    logger.error("[pdf-worker] Redis connection error", {
      error: error.message,
    });
  });

  const worker = new Worker<PdfIngestionJobData, PdfIngestionJobResult>(
    PDF_INGESTION_QUEUE_NAME,
    processPdfIngestionJob,
    {
      connection,

      concurrency: getConcurrency(),
    },
  );

  worker.on("completed", (job, result) => {
    logger.info("[pdf-worker] BullMQ job completed", {
      jobId: job.id,

      noteId: result.noteId,

      charCount: result.charCount,

      visionUsed: result.visionUsed,
    });
  });

  worker.on("failed", (job, error) => {
    if (!job) {
      return;
    }

    logger.error("[pdf-worker] BullMQ job attempt failed", {
      jobId: job.id,

      noteId: job.data.noteId,

      attemptsMade: job.attemptsMade,

      attempts: job.opts.attempts,

      error: error.message,
    });

    void handleJobFailure(job, error).catch((handlingError) => {
      logger.error("[pdf-worker] failure handling failed", {
        jobId: job.id,

        noteId: job.data.noteId,

        error:
          handlingError instanceof Error
            ? handlingError.message
            : String(handlingError),
      });
    });
  });

  worker.on("error", (error) => {
    logger.error("[pdf-worker] BullMQ worker error", {
      error: error.message,
    });
  });

  await worker.waitUntilReady();

  const stopHeartbeat = startWorkerHeartbeat(connection, "pdf-ingestion");

  logger.info("[pdf-worker] PDF ingestion worker ready", {
    queue: PDF_INGESTION_QUEUE_NAME,

    concurrency: getConcurrency(),
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    logger.info("[pdf-worker] shutting down", {
      signal,
    });

    try {
      await stopHeartbeat();

      await worker.close();

      await connection.quit();

      await disconnectDB();
    } catch (error) {
      logger.error("[pdf-worker] shutdown error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

void main().catch((error) => {
  logger.error("[pdf-worker] startup failed", {
    error: error instanceof Error ? error.message : String(error),
  });

  process.exitCode = 1;
});

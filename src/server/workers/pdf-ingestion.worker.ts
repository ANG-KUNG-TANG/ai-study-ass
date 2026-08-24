import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import {
  PDF_INGESTION_JOB_NAME,
  PDF_INGESTION_QUEUE_NAME,
  type PdfIngestionJobData,
  type PdfIngestionJobResult,
} from "@/server/queues/pdf-ingestion.queue";
import { connectDb, disconnectDB } from "@/server/config/database";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import {
  deleteTemporaryUpload,
  readTemporaryUpload,
} from "@/server/services/document-storage.service";
import { processUpload } from "@/server/services/upload.service";
import { enqueueStudyGeneration } from "@/server/queues/study-generation.queue";
import { startWorkerHeartbeat } from "@/server/services/system-health.service";
import { logger } from "@/server/utils/logger";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is not configured");
  return url;
}

function getConcurrency(): number {
  const parsed = Number.parseInt(process.env.PDF_WORKER_CONCURRENCY ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 2) : 1;
}

async function processPdfJob(
  job: Job<PdfIngestionJobData, PdfIngestionJobResult>,
): Promise<PdfIngestionJobResult> {
  if (job.name !== PDF_INGESTION_JOB_NAME) {
    throw new Error(`Unsupported PDF ingestion job: ${job.name}`);
  }

  const { noteId, userId, storageKey, telegramChatId } = job.data;
  const note = await noteRepo.findByIdAndUserId(noteId, userId);
  if (!note) throw new Error("PDF ingestion note is missing or not owned by the user");

  logger.info("[pdf-worker] extraction started", {
    jobId: job.id,
    noteId,
    userId,
    attempt: job.attemptsMade + 1,
  });

  const buffer = await readTemporaryUpload(storageKey);
  const processed = await processUpload({
    buffer,
    originalName: note.fileName,
    mimeType: "application/pdf",
    size: note.fileSize,
  });

  if (processed.fileType !== "pdf" || !processed.content.trim()) {
    throw new Error("PDF extraction completed without readable content");
  }

  await noteRepo.updateContent(noteId, processed.content, {
    pageCount: processed.pageCount,
    pages: processed.pages,
  });
  await generationRepo.updateStage(noteId, "pending");
  await enqueueStudyGeneration({
    noteId,
    userId,
    telegramChatId,
  });
  try {
    await deleteTemporaryUpload(storageKey);
  } catch (error) {
    logger.warn("[pdf-worker] temporary upload cleanup failed", {
      noteId,
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info("[pdf-worker] extraction completed", {
    jobId: job.id,
    noteId,
    pageCount: processed.pageCount ?? 0,
    charCount: processed.charCount,
  });

  return {
    noteId,
    pageCount: processed.pageCount ?? 0,
    charCount: processed.charCount,
    visionUsed: false,
  };
}

async function main(): Promise<void> {
  await connectDb();
  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  const worker = new Worker<PdfIngestionJobData, PdfIngestionJobResult>(
    PDF_INGESTION_QUEUE_NAME,
    processPdfJob,
    {
      connection,
      concurrency: getConcurrency(),
    },
  );

  worker.on("completed", (job, result) => {
    logger.info("[pdf-worker] BullMQ job completed", {
      jobId: job.id,
      noteId: result.noteId,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("[pdf-worker] BullMQ job attempt failed", {
      jobId: job?.id,
      noteId: job?.data.noteId,
      attemptsMade: job?.attemptsMade,
      attempts: job?.opts.attempts,
      error: error.message,
    });

    const attempts = typeof job?.opts.attempts === "number" ? job.opts.attempts : 1;
    if (job && job.attemptsMade >= attempts) {
      void Promise.allSettled([
        generationRepo.updateStage(job.data.noteId, "failed"),
        deleteTemporaryUpload(job.data.storageKey),
      ]);
    }
  });

  worker.on("error", (error) => {
    logger.error("[pdf-worker] BullMQ worker error", { error: error.message });
  });

  await worker.waitUntilReady();
  const stopHeartbeat = startWorkerHeartbeat(connection, "pdf-ingestion");

  logger.info("[pdf-worker] PDF ingestion worker ready", {
    queue: PDF_INGESTION_QUEUE_NAME,
    concurrency: getConcurrency(),
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("[pdf-worker] shutting down", { signal });
    await stopHeartbeat();
    await worker.close();
    await connection.quit();
    await disconnectDB();
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((error) => {
  logger.error("[pdf-worker] startup failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});

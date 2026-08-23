import { Queue } from "bullmq";

import IORedis from "ioredis";

import { logger } from "@/server/utils/logger";
import { ServiceUnavailableError } from "@/server/utils/errors";

export const PDF_INGESTION_QUEUE_NAME = "pdf-ingestion";

export const PDF_INGESTION_JOB_NAME = "process-pdf-ingestion";
export const PDF_INGESTION_MAX_QUEUE_DEPTH = 100;

export interface PdfIngestionJobData {
  noteId: string;
  userId: string;

  /**
   * Reference to file in shared upload storage.
   *
   * IMPORTANT:
   * Never put the PDF Buffer into BullMQ.
   */
  storageKey: string;

  telegramChatId?: number;
}

export interface PdfIngestionJobResult {
  noteId: string;
  pageCount: number;
  charCount: number;
  visionUsed: boolean;
}

export interface PdfIngestionRetryResult {
  jobId: string;
  noteId: string;
  userId: string;
  storageKey: string;
  previousState: string;
}


type PdfIngestionQueue = Queue<PdfIngestionJobData, PdfIngestionJobResult>;

type QueueGlobal = typeof globalThis & {
  __pdfIngestionQueue?: PdfIngestionQueue;

  __pdfIngestionQueueConnection?: IORedis;
};

const queueGlobal = globalThis as QueueGlobal;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  return url;
}

function getProducerConnection(): IORedis {
  if (queueGlobal.__pdfIngestionQueueConnection) {
    return queueGlobal.__pdfIngestionQueueConnection;
  }

  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: 1,

    enableReadyCheck: true,
  });

  connection.on("error", (error) => {
    logger.error("[queue] PDF ingestion Redis producer error", {
      queue: PDF_INGESTION_QUEUE_NAME,

      error: error.message,
    });
  });

  queueGlobal.__pdfIngestionQueueConnection = connection;

  return connection;
}

export function getPdfIngestionQueue(): PdfIngestionQueue {
  if (queueGlobal.__pdfIngestionQueue) {
    return queueGlobal.__pdfIngestionQueue;
  }

  const queue = new Queue<PdfIngestionJobData, PdfIngestionJobResult>(
    PDF_INGESTION_QUEUE_NAME,
    {
      connection: getProducerConnection(),

      defaultJobOptions: {
        attempts: 3,

        backoff: {
          type: "exponential",

          delay: 15_000,
        },

        removeOnComplete: {
          count: 100,
        },

        removeOnFail: {
          count: 100,
        },
      },
    },
  );

  queueGlobal.__pdfIngestionQueue = queue;

  return queue;
}

export async function enqueuePdfIngestion(
  data: PdfIngestionJobData,
): Promise<string> {
  const queue = getPdfIngestionQueue();

  const [waiting, active, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);

  if (waiting + active + delayed >= PDF_INGESTION_MAX_QUEUE_DEPTH) {
    throw new ServiceUnavailableError(
      "PDF processing is temporarily full — please try again later",
    );
  }

  const job = await queue.add(PDF_INGESTION_JOB_NAME, data, {
    jobId: `pdf-ingest-${data.noteId}`,
  });

  logger.info("[queue] PDF ingestion queued", {
    queue: PDF_INGESTION_QUEUE_NAME,

    jobId: job.id,

    noteId: data.noteId,

    userId: data.userId,

    storageKey: data.storageKey,

    telegramNotification: Boolean(data.telegramChatId),
  });

  return String(job.id);
}

export async function retryPdfIngestion(
  noteId: string,
): Promise<PdfIngestionRetryResult> {
  const queue = getPdfIngestionQueue();

  const jobId = `pdf-ingest-${noteId}`;

  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`PDF ingestion job not found for note ${noteId}`);
  }

  const state = await job.getState();

  if (state !== "failed") {
    throw new Error(
      `PDF ingestion job cannot be retried from state "${state}".`,
    );
  }

  const { userId, storageKey } = job.data;

  if (!userId || !storageKey) {
    throw new Error("PDF ingestion job is missing retry metadata.");
  }

  await job.retry("failed", {
    resetAttemptsMade: true,

    resetAttemptsStarted: true,
  });

  logger.info("[queue] PDF ingestion manually retried", {
    queue: PDF_INGESTION_QUEUE_NAME,

    jobId,

    noteId,

    userId,

    storageKey,

    previousState: state,
  });

  return {
    jobId,
    noteId,
    userId,
    storageKey,
    previousState: state,
  };
}

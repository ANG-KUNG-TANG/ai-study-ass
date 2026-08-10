import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import {
  STUDY_GENERATION_JOB_NAME,
  STUDY_GENERATION_QUEUE_NAME,
  type StudyGenerationJobData,
  type StudyGenerationJobResult,
} from "@/server/queues/study-generation.queue";
import { connectDb, disconnectDB } from "@/server/config/database";
import * as noteRepo from "@/server/repositories/note.repo";
import { generateStudyMaterials } from "@/server/services/study-material-generation.service";
import {
  notifyTelegramGenerationComplete,
  notifyTelegramGenerationFailure,
} from "@/server/services/telegramGenerationNotification.service";
import { logger } from "@/server/utils/logger";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  return url;
}

function getConcurrency(): number {
  const parsed = Number.parseInt(
    process.env.GENERATION_WORKER_CONCURRENCY ?? "1",
    10,
  );

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 5);
}

async function notifyCompletion(
  job: Job<StudyGenerationJobData>,
  state: Awaited<ReturnType<typeof generateStudyMaterials>>,
): Promise<void> {
  const chatId = job.data.telegramChatId;

  if (!chatId) {
    return;
  }

  try {
    const note = await noteRepo.findByIdOrThrow(job.data.noteId);

    await notifyTelegramGenerationComplete(chatId, note.toPublic(), state);
  } catch (error) {
    logger.error("[worker] Telegram completion notification failed", {
      jobId: job.id,
      noteId: job.data.noteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function notifyFinalFailure(
  job: Job<StudyGenerationJobData> | undefined,
  error: Error,
): Promise<void> {
  if (!job?.data.telegramChatId) {
    return;
  }

  const maxAttempts =
    typeof job.opts.attempts === "number" ? job.opts.attempts : 1;

  if (job.attemptsMade < maxAttempts) {
    return;
  }

  try {
    const note = await noteRepo.findByIdOrThrow(job.data.noteId);

    await notifyTelegramGenerationFailure(
      job.data.telegramChatId,
      note.toPublic(),
      error,
    );
  } catch (notificationError) {
    logger.error("[worker] Telegram failure notification failed", {
      jobId: job.id,
      noteId: job.data.noteId,
      error:
        notificationError instanceof Error
          ? notificationError.message
          : String(notificationError),
    });
  }
}

async function processStudyGenerationJob(
  job: Job<StudyGenerationJobData>,
): Promise<StudyGenerationJobResult> {
  if (job.name !== STUDY_GENERATION_JOB_NAME) {
    throw new Error(`Unsupported study generation job: ${job.name}`);
  }

  logger.info("[worker] study generation started", {
    jobId: job.id,
    noteId: job.data.noteId,
    userId: job.data.userId,
    attempt: job.attemptsMade + 1,
  });

  const state = await generateStudyMaterials({
    noteId: job.data.noteId,
    userId: job.data.userId,
    force: job.data.force,
  });

  await notifyCompletion(job, state);

  logger.info("[worker] study generation finished", {
    jobId: job.id,
    noteId: job.data.noteId,
    stage: state.stage,
  });

  return {
    noteId: job.data.noteId,
    stage: state.stage,
  };
}

async function main(): Promise<void> {
  await connectDb();

  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  connection.on("error", (error) => {
    logger.error("[worker] Redis connection error", {
      error: error.message,
    });
  });

  const worker = new Worker<StudyGenerationJobData, StudyGenerationJobResult>(
    STUDY_GENERATION_QUEUE_NAME,
    processStudyGenerationJob,
    {
      connection,
      concurrency: getConcurrency(),
    },
  );

  worker.on("completed", (job, result) => {
    logger.info("[worker] BullMQ job completed", {
      jobId: job.id,
      noteId: result.noteId,
      stage: result.stage,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("[worker] BullMQ job attempt failed", {
      jobId: job?.id,
      noteId: job?.data.noteId,
      attemptsMade: job?.attemptsMade,
      attempts: job?.opts.attempts,
      error: error.message,
    });

    void notifyFinalFailure(job, error);
  });

  worker.on("error", (error) => {
    logger.error("[worker] BullMQ worker error", {
      error: error.message,
    });
  });

  await worker.waitUntilReady();

  logger.info("[worker] study generation worker ready", {
    queue: STUDY_GENERATION_QUEUE_NAME,
    concurrency: getConcurrency(),
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    logger.info("[worker] shutting down", {
      signal,
    });

    try {
      await worker.close();
      await connection.quit();
      await disconnectDB();
    } catch (error) {
      logger.error("[worker] shutdown error", {
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
  logger.error("[worker] startup failed", {
    error: error instanceof Error ? error.message : String(error),
  });

  process.exitCode = 1;
});

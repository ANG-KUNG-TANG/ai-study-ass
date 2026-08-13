import { Queue } from "bullmq";
import IORedis from "ioredis";

import { logger } from "@/server/utils/logger";

export const STUDY_GENERATION_QUEUE_NAME = "study-generation";
export const STUDY_GENERATION_JOB_NAME = "generate-study-materials";

export interface StudyGenerationJobData {
  noteId: string;
  userId: string;
  telegramChatId?: number;
  force?: boolean;
}

export interface StudyGenerationJobResult {
  noteId: string;
  stage: string;
}

type StudyGenerationQueue = Queue<
  StudyGenerationJobData,
  StudyGenerationJobResult
>;

type QueueGlobal = typeof globalThis & {
  __studyGenerationQueue?: StudyGenerationQueue;
  __studyGenerationQueueConnection?: IORedis;
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
  if (queueGlobal.__studyGenerationQueueConnection) {
    return queueGlobal.__studyGenerationQueueConnection;
  }

  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    enableOfflineQueue: false,
    connectTimeout: 3_000,
  });

  connection.on("error", (error) => {
    logger.error("[queue] Redis producer connection error", {
      queue: STUDY_GENERATION_QUEUE_NAME,
      error: error.message,
    });
  });

  queueGlobal.__studyGenerationQueueConnection = connection;

  return connection;
}

export function getStudyGenerationQueue(): StudyGenerationQueue {
  if (queueGlobal.__studyGenerationQueue) {
    return queueGlobal.__studyGenerationQueue;
  }

  const queue = new Queue<StudyGenerationJobData, StudyGenerationJobResult>(
    STUDY_GENERATION_QUEUE_NAME,
    {
      connection: getProducerConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
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

  queueGlobal.__studyGenerationQueue = queue;

  return queue;
}

export interface StudyGenerationRetryResult {
  status: "queued" | "already-running";
  jobId: string;
  state?: string;
}

export async function retryStudyGeneration(
  data: StudyGenerationJobData,
): Promise<StudyGenerationRetryResult> {
  const queue = getStudyGenerationQueue();
  const jobId = `study-${data.noteId}`;

  const retryData: StudyGenerationJobData = {
    ...data,
    force: true,
  };

  const existing = await queue.getJob(jobId);

  // Old job may already have been auto-removed.
  if (!existing) {
    const newJobId = await enqueueStudyGeneration(retryData);

    return {
      status: "queued",
      jobId: newJobId,
    };
  }

  const state = await existing.getState();

  // The job disappeared between getJob() and getState().
  if (state === "unknown") {
    const newJobId = await enqueueStudyGeneration(retryData);

    return {
      status: "queued",
      jobId: newJobId,
    };
  }

  // BullMQ can manually retry both failed and completed jobs.
  if (state === "failed" || state === "completed") {
    await existing.updateData({
      ...existing.data,
      ...retryData,
    });

    await existing.retry(state, {
      resetAttemptsMade: true,
      resetAttemptsStarted: true,
    });

    logger.info("[queue] study generation manually retried", {
      queue: STUDY_GENERATION_QUEUE_NAME,
      jobId: existing.id,
      noteId: data.noteId,
      userId: data.userId,
      previousState: state,
    });

    return {
      status: "queued",
      jobId: String(existing.id),
    };
  }

  // Do not create another copy while one is already waiting/running.
  logger.info("[queue] study generation retry skipped", {
    queue: STUDY_GENERATION_QUEUE_NAME,
    jobId: existing.id,
    noteId: data.noteId,
    state,
  });

  return {
    status: "already-running",
    jobId: String(existing.id),
    state,
  };
}

export async function enqueueStudyGeneration(
  data: StudyGenerationJobData,
): Promise<string> {
  const queue = getStudyGenerationQueue();

  const jobId = `study-${data.noteId}`;

  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();

    const isTerminal = state === "completed" || state === "failed";

    /**
     * Completed/failed jobs are retained by BullMQ.
     * A manual force-regeneration must remove the old
     * terminal job before reusing the canonical job id.
     */
    if (data.force && isTerminal) {
      await existing.remove();

      logger.info(
        "[queue] removed terminal study generation job for regeneration",
        {
          queue: STUDY_GENERATION_QUEUE_NAME,

          jobId,

          noteId: data.noteId,

          previousState: state,
        },
      );
    } else {
      /**
       * A waiting/active/delayed job already owns this
       * note. Do not create duplicate generation work.
       */
      logger.info("[queue] study generation job already exists", {
        queue: STUDY_GENERATION_QUEUE_NAME,

        jobId: existing.id,

        noteId: data.noteId,

        state,
      });

      return String(existing.id);
    }
  }

  const job = await queue.add(STUDY_GENERATION_JOB_NAME, data, {
    jobId,
  });

  logger.info("[queue] study generation job queued", {
    queue: STUDY_GENERATION_QUEUE_NAME,

    jobId: job.id,

    noteId: data.noteId,

    userId: data.userId,

    force: Boolean(data.force),

    telegramNotification: Boolean(data.telegramChatId),
  });

  return String(job.id);
}

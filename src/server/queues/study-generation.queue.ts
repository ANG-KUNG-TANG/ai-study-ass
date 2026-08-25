import { Queue } from "bullmq";
import IORedis from "ioredis";

import { logger } from "@/server/utils/logger";
import {
  ConflictError,
  ServiceUnavailableError,
} from "@/server/utils/errors";

export const STUDY_GENERATION_QUEUE_NAME = "study-generation";
export const STUDY_GENERATION_JOB_NAME = "generate-study-materials";
export const STUDY_GENERATION_MAX_QUEUE_DEPTH = 500;

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

export interface StudyGenerationQueueJob {
  jobId: string;
  state: string;
  attemptsMade: number;
  failedReason: string | null;
  queuedAt: Date;
  processedAt: Date | null;
  finishedAt: Date | null;
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

  const queue = new Queue<
    StudyGenerationJobData,
    StudyGenerationJobResult
  >(STUDY_GENERATION_QUEUE_NAME, {
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
  });

  queueGlobal.__studyGenerationQueue = queue;

  return queue;
}

export async function enqueueStudyGeneration(
  data: StudyGenerationJobData,
): Promise<string> {
  const queue = getStudyGenerationQueue();
  const jobId = `study-${data.noteId}`;
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();

    if (
      state === "active" ||
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized" ||
      state === "waiting-children"
    ) {
      throw new ConflictError(
        "Study material generation is already in progress",
      );
    }

    await existing.remove();
  }

  const [waitingCount, activeCount, delayedCount] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);

  const liveQueueDepth =
    waitingCount + activeCount + delayedCount;

  if (liveQueueDepth >= STUDY_GENERATION_MAX_QUEUE_DEPTH) {
    logger.warn("[queue] study generation backlog limit reached", {
      queue: STUDY_GENERATION_QUEUE_NAME,
      liveQueueDepth,
      waitingCount,
      activeCount,
      delayedCount,
      limit: STUDY_GENERATION_MAX_QUEUE_DEPTH,
    });

    throw new ServiceUnavailableError(
      "Study generation queue is temporarily full — please try again later",
    );
  }

  const job = await queue.add(
    STUDY_GENERATION_JOB_NAME,
    data,
    {
      jobId,
    },
  );

  logger.info("[queue] study generation job queued", {
    queue: STUDY_GENERATION_QUEUE_NAME,
    jobId: job.id,
    noteId: data.noteId,
    userId: data.userId,
    telegramNotification: Boolean(data.telegramChatId),
  });

  return String(job.id);
}

export async function getStudyGenerationJob(
  noteId: string,
): Promise<StudyGenerationQueueJob | null> {
  const job = await getStudyGenerationQueue().getJob(`study-${noteId}`);
  if (!job) return null;
  return {
    jobId: String(job.id),
    state: await job.getState(),
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    queuedAt: new Date(job.timestamp),
    processedAt: job.processedOn ? new Date(job.processedOn) : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
  };
}

export async function cancelStudyGeneration(
  noteId: string,
): Promise<{ jobId: string; previousState: string }> {
  const job = await getStudyGenerationQueue().getJob(`study-${noteId}`);
  if (!job) throw new ConflictError("No study-generation job exists for this content");
  const state = await job.getState();
  if (!["waiting", "delayed", "prioritized", "waiting-children"].includes(state)) {
    throw new ConflictError(
      state === "active"
        ? "An active job cannot be cancelled safely; wait for it to finish"
        : `A job in state \"${state}\" cannot be cancelled`,
    );
  }
  await job.remove();
  logger.info("[queue] study generation job cancelled", {
    queue: STUDY_GENERATION_QUEUE_NAME,
    jobId: job.id,
    noteId,
    previousState: state,
  });
  return { jobId: String(job.id), previousState: state };
}

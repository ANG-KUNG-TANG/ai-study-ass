import type IORedis from "ioredis";

import { getRedisClient } from "@/server/config/redis";
import { getPdfIngestionQueue } from "@/server/queues/pdf-ingestion.queue";
import { getStudyGenerationQueue } from "@/server/queues/study-generation.queue";
import { logger } from "@/server/utils/logger";

export const WORKER_HEARTBEAT_TTL_SECONDS = 90;
const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;

export type WorkerHealthName = "study-generation" | "pdf-ingestion";

export interface RedisHealthSnapshot {
  connected: boolean;
  latencyMs: number | null;
}

export interface QueueHealthSnapshot {
  available: boolean;
  waiting: number | null;
  active: number | null;
  completed: number | null;
  failed: number | null;
  delayed: number | null;
}

export interface WorkerHealthSnapshot {
  online: boolean;
  lastHeartbeatAt: string | null;
  ageMs: number | null;
}

export interface InfrastructureHealthSnapshot {
  redis: RedisHealthSnapshot;
  queues: {
    studyGeneration: QueueHealthSnapshot;
    pdfIngestion: QueueHealthSnapshot;
  };
  workers: {
    studyGeneration: WorkerHealthSnapshot;
    pdfIngestion: WorkerHealthSnapshot;
  };
}

function heartbeatKey(worker: WorkerHealthName): string {
  return `health:worker:${worker}`;
}

function emptyQueueHealth(): QueueHealthSnapshot {
  return {
    available: false,
    waiting: null,
    active: null,
    completed: null,
    failed: null,
    delayed: null,
  };
}

async function readQueueHealth(
  queue:
    | ReturnType<typeof getStudyGenerationQueue>
    | ReturnType<typeof getPdfIngestionQueue>,
): Promise<QueueHealthSnapshot> {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      available: true,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  } catch (error) {
    logger.warn("[health] queue health check failed", {
      queue: queue.name,
      error: error instanceof Error ? error.message : String(error),
    });

    return emptyQueueHealth();
  }
}

async function readWorkerHealth(
  worker: WorkerHealthName,
): Promise<WorkerHealthSnapshot> {
  try {
    const client = await getRedisClient();
    const raw = await client.get(heartbeatKey(worker));

    if (!raw) {
      return {
        online: false,
        lastHeartbeatAt: null,
        ageMs: null,
      };
    }

    const timestamp = Date.parse(raw);

    if (Number.isNaN(timestamp)) {
      return {
        online: false,
        lastHeartbeatAt: null,
        ageMs: null,
      };
    }

    const ageMs = Math.max(0, Date.now() - timestamp);

    return {
      online: ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1_000,
      lastHeartbeatAt: new Date(timestamp).toISOString(),
      ageMs,
    };
  } catch (error) {
    logger.warn("[health] worker heartbeat read failed", {
      worker,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      online: false,
      lastHeartbeatAt: null,
      ageMs: null,
    };
  }
}

export async function getInfrastructureHealth(): Promise<InfrastructureHealthSnapshot> {
  const startedAt = Date.now();

  try {
    const client = await getRedisClient();
    const pong = await client.ping();

    if (pong !== "PONG") {
      throw new Error(`Unexpected Redis PING response: ${pong}`);
    }
  } catch (error) {
    logger.warn("[health] Redis health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      redis: {
        connected: false,
        latencyMs: Date.now() - startedAt,
      },
      queues: {
        studyGeneration: emptyQueueHealth(),
        pdfIngestion: emptyQueueHealth(),
      },
      workers: {
        studyGeneration: {
          online: false,
          lastHeartbeatAt: null,
          ageMs: null,
        },
        pdfIngestion: {
          online: false,
          lastHeartbeatAt: null,
          ageMs: null,
        },
      },
    };
  }

  const [studyGeneration, pdfIngestion, studyWorker, pdfWorker] =
    await Promise.all([
      readQueueHealth(getStudyGenerationQueue()),
      readQueueHealth(getPdfIngestionQueue()),
      readWorkerHealth("study-generation"),
      readWorkerHealth("pdf-ingestion"),
    ]);

  return {
    redis: {
      connected: true,
      latencyMs: Date.now() - startedAt,
    },
    queues: {
      studyGeneration,
      pdfIngestion,
    },
    workers: {
      studyGeneration: studyWorker,
      pdfIngestion: pdfWorker,
    },
  };
}

export function startWorkerHeartbeat(
  connection: IORedis,
  worker: WorkerHealthName,
): () => Promise<void> {
  const key = heartbeatKey(worker);

  const publish = async (): Promise<void> => {
    try {
      await connection.set(
        key,
        new Date().toISOString(),
        "EX",
        WORKER_HEARTBEAT_TTL_SECONDS,
      );
    } catch (error) {
      logger.warn("[health] worker heartbeat write failed", {
        worker,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void publish();

  const timer = setInterval(() => {
    void publish();
  }, WORKER_HEARTBEAT_INTERVAL_MS);

  timer.unref?.();

  return async () => {
    clearInterval(timer);

    try {
      await connection.del(key);
    } catch (error) {
      logger.warn("[health] worker heartbeat cleanup failed", {
        worker,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

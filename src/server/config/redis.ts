import { createClient } from "redis";

import { logger } from "@/server/utils/logger";

// ─── Client Factory ──────────────────────────────────────────────────────────

function createRedisClient() {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      "REDIS_URL is not configured",
    );
  }

  const client = createClient({
    url,
  });

  client.on("error", (error) => {
    logger.error("[redis] client error", {
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  });

  client.on("connect", () => {
    logger.info("[redis] connecting");
  });

  client.on("ready", () => {
    logger.info("[redis] ready");
  });

  client.on("reconnecting", () => {
    logger.warn("[redis] reconnecting");
  });

  return client;
}

// IMPORTANT:
// Infer the type from OUR actual configured client.
// Do not use RedisClientType or ReturnType<typeof createClient>.
type AppRedisClient =
  ReturnType<typeof createRedisClient>;

type RedisGlobal =
  typeof globalThis & {
    __aiStudyRedisClient?: AppRedisClient;
    __aiStudyRedisConnectPromise?:
      Promise<AppRedisClient>;
  };

const globalRedis =
  globalThis as RedisGlobal;

// ─── Connection ──────────────────────────────────────────────────────────────

export async function getRedisClient():
Promise<AppRedisClient> {
  if (!globalRedis.__aiStudyRedisClient) {
    globalRedis.__aiStudyRedisClient =
      createRedisClient();
  }

  const client =
    globalRedis.__aiStudyRedisClient;

  if (client.isReady) {
    return client;
  }

  if (
    !globalRedis.__aiStudyRedisConnectPromise
  ) {
    globalRedis.__aiStudyRedisConnectPromise =
      client
        .connect()
        .then(() => client)
        .finally(() => {
          globalRedis.__aiStudyRedisConnectPromise =
            undefined;
        });
  }

  return globalRedis
    .__aiStudyRedisConnectPromise;
}

// ─── Health Check ────────────────────────────────────────────────────────────

export async function pingRedis():
Promise<boolean> {
  try {
    const client =
      await getRedisClient();

    const result =
      await client.ping();

    return result === "PONG";
  } catch (error) {
    logger.error("[redis] ping failed", {
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return false;
  }
}

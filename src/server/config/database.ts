import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  eventsRegistered: boolean;
}

declare global {
   
  var __mongoose: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__mongoose ?? {
  conn: null,
  promise: null,
  eventsRegistered: false,
};

globalThis.__mongoose = cache;

const CONNECTION_OPTIONS: mongoose.ConnectOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
  heartbeatFrequencyMS: 10_000,
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registerConnectionEvents(): void {
  if (cache.eventsRegistered) return;
  cache.eventsRegistered = true;

  mongoose.connection.on("connected", () => {
    logger.info("[db] connected to MongoDB");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("[db] disconnected from MongoDB");
    cache.conn = null;
    cache.promise = null;
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("[db] reconnected to MongoDB");
  });

  mongoose.connection.on("error", (error: Error) => {
    logger.error("[db] connection error", { message: error.message });
  });
}

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (cache.promise) return cache.promise;

  registerConnectionEvents();

  cache.promise = (async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const connection = await mongoose.connect(env.MONGODB_URI, CONNECTION_OPTIONS);
        cache.conn = connection;
        return connection;
      } catch (unknownError) {
        const error = unknownError instanceof Error
          ? unknownError
          : new Error(String(unknownError));

        if (attempt === MAX_RETRIES) {
          cache.promise = null;
          throw new Error(
            `[db] failed to connect after ${MAX_RETRIES} attempts: ${error.message}`,
          );
        }

        logger.warn("[db] connection attempt failed", {
          attempt,
          maxRetries: MAX_RETRIES,
          retryInMs: RETRY_DELAY_MS * attempt,
          message: error.message,
        });
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    throw new Error("[db] unreachable");
  })();

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!cache.conn && mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
  logger.info("[db] disconnected cleanly");
}

/** @deprecated Use disconnectDB. */
export const disxonnectDB = disconnectDB;

export async function checkDBHealth(): Promise<{
  status: "ok" | "error";
  message: string;
  latencyMs?: number;
}> {
  try {
    const state = mongoose.connection.readyState;
    if (state !== 1 || !mongoose.connection.db) {
      return {
        status: "error",
        message: `MongoDB not connected (readyState: ${state})`,
      };
    }

    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return {
      status: "ok",
      message: "MongoDB reachable",
      latencyMs: Date.now() - start,
    };
  } catch (unknownError) {
    return {
      status: "error",
      message: unknownError instanceof Error
        ? unknownError.message
        : String(unknownError),
    };
  }
}

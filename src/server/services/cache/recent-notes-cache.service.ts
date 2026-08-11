import { getRedisClient } from "@/server/config/redis";
import type {
  NoteListItem,
  PaginatedNoteList,
} from "@/server/repositories/note.repo";
import { logger } from "@/server/utils/logger";

const RECENT_NOTES_TTL_SECONDS = 30;

function cacheKey(userId: string): string {
  return `ai-study:user:${userId}:recent-notes`;
}

function reviveNote(value: unknown): NoteListItem {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid cached recent note");
  }

  const note = value as Record<string, unknown>;

  if (
    typeof note.id !== "string" ||
    typeof note.userId !== "string" ||
    typeof note.title !== "string" ||
    typeof note.fileName !== "string" ||
    (note.fileType !== "pdf" && note.fileType !== "docx") ||
    typeof note.fileSize !== "number"
  ) {
    throw new Error("Invalid cached recent note shape");
  }

  return {
    id: note.id,
    userId: note.userId,
    title: note.title,
    fileName: note.fileName,
    fileType: note.fileType,
    fileSize: note.fileSize,
    summary:
      typeof note.summary === "string"
        ? note.summary
        : null,
    createdAt: new Date(String(note.createdAt)),
    updatedAt: new Date(String(note.updatedAt)),
  };
}

function parsePayload(raw: string): PaginatedNoteList {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (
    !Array.isArray(parsed.data) ||
    typeof parsed.total !== "number" ||
    typeof parsed.page !== "number" ||
    typeof parsed.limit !== "number"
  ) {
    throw new Error("Invalid cached recent-notes payload");
  }

  return {
    data: parsed.data.map(reviveNote),
    total: parsed.total,
    page: parsed.page,
    limit: parsed.limit,
  };
}

export async function getRecentNotesCache(
  userId: string,
): Promise<PaginatedNoteList | null> {
  try {
    const client = await getRedisClient();
    const raw = await client.get(cacheKey(userId));

    if (!raw) {
      return null;
    }

    try {
      return parsePayload(raw);
    } catch (error) {
      await client.del(cacheKey(userId));

      logger.warn("[cache] invalid recent-notes payload removed", {
        userId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      return null;
    }
  } catch (error) {
    logger.warn("[cache] recent-notes read failed", {
      userId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return null;
  }
}

export async function setRecentNotesCache(
  userId: string,
  payload: PaginatedNoteList,
): Promise<void> {
  try {
    const client = await getRedisClient();

    await client.set(
      cacheKey(userId),
      JSON.stringify(payload),
      {
        EX: RECENT_NOTES_TTL_SECONDS,
      },
    );
  } catch (error) {
    logger.warn("[cache] recent-notes write failed", {
      userId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

export async function invalidateRecentNotesCache(
  userId: string,
): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(cacheKey(userId));
  } catch (error) {
    logger.warn("[cache] recent-notes invalidation failed", {
      userId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

export function getRecentNotesCacheKey(
  userId: string,
): string {
  return cacheKey(userId);
}

import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { logger } from "@/server/utils/logger";

const SAFE_STORAGE_KEY = /^[a-zA-Z0-9._-]+$/;

function getStorageDirectory(): string {
  const configured = process.env.UPLOAD_STORAGE_DIR?.trim();

  if (configured) {
    return configured;
  }

  return path.join(process.cwd(), "storage", "uploads");
}

function assertSafeStorageKey(storageKey: string): void {
  if (!storageKey || !SAFE_STORAGE_KEY.test(storageKey)) {
    throw new Error("Invalid upload storage key");
  }

  if (path.basename(storageKey) !== storageKey) {
    throw new Error("Invalid upload storage path");
  }
}

function resolveStoragePath(storageKey: string): string {
  assertSafeStorageKey(storageKey);

  return path.join(getStorageDirectory(), storageKey);
}

export async function saveTemporaryUpload(
  noteId: string,
  buffer: Buffer,
): Promise<string> {
  if (!buffer.length) {
    throw new Error("Cannot store an empty upload");
  }

  const storageDirectory = getStorageDirectory();

  await mkdir(storageDirectory, {
    recursive: true,
  });

  const storageKey = `${noteId}-${randomUUID()}.pdf`;

  const finalPath = resolveStoragePath(storageKey);

  const temporaryPath = `${finalPath}.tmp`;

  try {
    await writeFile(temporaryPath, buffer);

    // Atomic hand-off.
    //
    // The worker will never see
    // a partially written PDF.
    await rename(temporaryPath, finalPath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch {
      // Ignore cleanup errors.
    }

    throw error;
  }

  logger.info("[storage] temporary upload saved", {
    noteId,
    storageKey,
    size: buffer.length,
  });

  return storageKey;
}

export async function readTemporaryUpload(storageKey: string): Promise<Buffer> {
  const filePath = resolveStoragePath(storageKey);

  const buffer = await readFile(filePath);

  if (!buffer.length) {
    throw new Error(`Stored upload ${storageKey} is empty`);
  }

  return buffer;
}

export async function deleteTemporaryUpload(storageKey: string): Promise<void> {
  const filePath = resolveStoragePath(storageKey);

  try {
    await unlink(filePath);

    logger.info("[storage] temporary upload deleted", {
      storageKey,
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

export async function temporaryUploadExists(
  storageKey: string,
): Promise<boolean> {
  const filePath = resolveStoragePath(storageKey);

  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
}

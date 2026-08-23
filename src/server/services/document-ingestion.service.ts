import type {
  ProcessedFile,
  UploadedFile,
} from "@/server/services/upload.service";
import {
  prepareUpload,
  processUpload,
} from "@/server/services/upload.service";
import {
  createNote,
  type CreateNoteOptions,
  type PublicNote,
} from "@/server/services/note.service";
import {
  deleteTemporaryUpload,
  saveTemporaryUpload,
} from "@/server/services/document-storage.service";
import { enqueuePdfIngestion } from "@/server/queues/pdf-ingestion.queue";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { logger } from "@/server/utils/logger";

const PROCESSING_PLACEHOLDER = "PDF extraction is running in the background.";

export interface DocumentIngestionResult {
  note: PublicNote;
  backgroundProcessing: boolean;
}

async function rollback(
  noteId: string,
  storageKey?: string,
): Promise<void> {
  await Promise.allSettled([
    storageKey
      ? deleteTemporaryUpload(storageKey)
      : Promise.resolve(),
    generationRepo.deleteByNoteId(noteId),
    noteRepo.deleteById(noteId),
  ]);
}

/**
 * DOCX extraction stays in the request path. PDF extraction is isolated in a
 * dedicated BullMQ worker so a large document cannot block the web container.
 */
export async function ingestDocument(
  userId: string,
  file: UploadedFile,
  options: CreateNoteOptions = {},
): Promise<DocumentIngestionResult> {
  const prepared = prepareUpload(file);

  if (prepared.fileType !== "pdf") {
    const processed = await processUpload(file);
    const note = await createNote(userId, processed, options);

    return {
      note,
      backgroundProcessing: false,
    };
  }

  const pendingFile: ProcessedFile = {
    ...prepared,
    content: PROCESSING_PLACEHOLDER,
    charCount: PROCESSING_PLACEHOLDER.length,
  };
  const note = await createNote(userId, pendingFile, {
    ...options,
    deferGeneration: true,
  });
  let storageKey: string | undefined;

  try {
    storageKey = await saveTemporaryUpload(note.id, file.buffer);
    await generationRepo.initialise(note.id, userId, true);
    await enqueuePdfIngestion({
      noteId: note.id,
      userId,
      storageKey,
      telegramChatId: options.telegramChatId,
    });

    logger.info("PDF queued for background extraction", {
      noteId: note.id,
      userId,
      storageKey,
    });

    return {
      note,
      backgroundProcessing: true,
    };
  } catch (error) {
    await rollback(note.id, storageKey);
    throw error;
  }
}

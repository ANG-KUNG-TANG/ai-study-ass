import type {
  UploadedFile,
  ProcessedFile,
} from "@/server/services/upload.service";

import { inspectUpload } from "@/server/services/upload.service";

import {
  createNote,
  type CreateNoteOptions,
  type PublicNote,
} from "@/server/services/note.service";

import {
  saveTemporaryUpload,
  deleteTemporaryUpload,
} from "@/server/services/document-storage.service";

import { enqueuePdfIngestion } from "@/server/queues/pdf-ingestion.queue";

import * as noteRepo from "@/server/repositories/note.repo";

import * as generationRepo from "@/server/repositories/study-generation.repo";

import { logger } from "@/server/utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentIngestionResult {
  note: PublicNote;

  /**
   * false:
   * document was already readable
   * and study generation was queued immediately.
   *
   * true:
   * PDF OCR is running through BullMQ first.
   */
  backgroundProcessing: boolean;

  pageCount?: number;

  extractionQuality?: "normal" | "low-text" | "image-heavy";
}

// ─────────────────────────────────────────────────────────────────────────────
// Temporary content
// ─────────────────────────────────────────────────────────────────────────────

const PROCESSING_PLACEHOLDER = "Document processing is in progress.";

// ─────────────────────────────────────────────────────────────────────────────
// Rollback
// ─────────────────────────────────────────────────────────────────────────────

async function rollbackPendingIngestion(
  noteId: string,
  storageKey?: string,
): Promise<void> {
  if (storageKey) {
    try {
      await deleteTemporaryUpload(storageKey);
    } catch (error) {
      logger.error("Failed to remove temporary upload during rollback", {
        noteId,

        storageKey,

        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await generationRepo.deleteByNoteId(noteId);
  } catch (error) {
    logger.error(
      "Failed to remove generation status during ingestion rollback",
      {
        noteId,

        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  try {
    await noteRepo.deleteById(noteId);
  } catch (error) {
    logger.error("Failed to remove note during ingestion rollback", {
      noteId,

      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestration
// ─────────────────────────────────────────────────────────────────────────────

export async function ingestDocument(
  userId: string,
  file: UploadedFile,
  options: CreateNoteOptions = {},
): Promise<DocumentIngestionResult> {
  const inspection = await inspectUpload(file);

  // ═══════════════════════════════════════════════════════════════════════════
  // READY DOCUMENT
  //
  // DOCX
  // or
  // normal/native PDF
  //
  // Existing generation pipeline continues unchanged.
  // ═══════════════════════════════════════════════════════════════════════════

  if (inspection.mode === "ready") {
    const note = await createNote(userId, inspection.processed, options);

    logger.info("Document ingestion completed synchronously", {
      noteId: note.id,

      userId,

      fileType: inspection.processed.fileType,

      charCount: inspection.processed.charCount,
    });

    return {
      note,

      backgroundProcessing: false,

      pageCount: inspection.processed.pageCount,

      extractionQuality: inspection.processed.extractionQuality,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISION PDF
  //
  // Do NOT perform OCR in HTTP request.
  // ═══════════════════════════════════════════════════════════════════════════

  const temporaryContent =
    inspection.nativeText.trim() || PROCESSING_PLACEHOLDER;

  const pendingFile: ProcessedFile = {
    fileName: inspection.fileName,

    fileType: "pdf",

    fileSize: inspection.fileSize,

    /**
     * This content is temporary.
     *
     * The PDF worker replaces it with
     * canonical OCR content.
     */
    content: temporaryContent,

    pageCount: inspection.pageCount,

    charCount: temporaryContent.length,

    extractionQuality: inspection.extractionQuality,

    charsPerPage: inspection.charsPerPage,

    requiresVisionFallback: true,

    visionFallbackUsed: false,
  };

  // ─────────────────────────────────────────────────────────────
  // Create note WITHOUT study generation.
  // ─────────────────────────────────────────────────────────────

  const note = await createNote(userId, pendingFile, {
    ...options,

    deferGeneration: true,
  });

  let storageKey: string | undefined;

  try {
    // ───────────────────────────────────────────────────────────
    // Store raw PDF outside Redis.
    // ───────────────────────────────────────────────────────────

    storageKey = await saveTemporaryUpload(note.id, file.buffer);

    // ───────────────────────────────────────────────────────────
    // Create visible processing state.
    // ───────────────────────────────────────────────────────────

    await generationRepo.initialise(note.id, userId, true);

    await generationRepo.updateStage(note.id, "vision_ocr");

    // ───────────────────────────────────────────────────────────
    // Queue background ingestion.
    // ───────────────────────────────────────────────────────────

    await enqueuePdfIngestion({
      noteId: note.id,

      userId,

      storageKey,

      telegramChatId: options.telegramChatId,
    });

    logger.info("PDF sent to background ingestion", {
      noteId: note.id,

      userId,

      pageCount: inspection.pageCount,

      extractionQuality: inspection.extractionQuality,

      nativeCharCount: inspection.nativeCharCount,

      storageKey,
    });

    return {
      note,

      backgroundProcessing: true,

      pageCount: inspection.pageCount,

      extractionQuality: inspection.extractionQuality,
    };
  } catch (error) {
    logger.error("Failed to start background PDF ingestion", {
      noteId: note.id,

      userId,

      error: error instanceof Error ? error.message : String(error),
    });

    await rollbackPendingIngestion(note.id, storageKey);

    throw error;
  }
}

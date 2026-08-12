import * as noteRepo from "@/server/repositories/note.repo";

import * as generationRepo from "@/server/repositories/study-generation.repo";

import {
  getPdfIngestionQueue,
  retryPdfIngestion,
} from "@/server/queues/pdf-ingestion.queue";

import { temporaryUploadExists } from "@/server/services/document-storage.service";

import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "@/server/utils/errors";

import { logger } from "@/server/utils/logger";

export interface RetryPdfIngestionResult {
  noteId: string;

  jobId: string;

  stage: "vision_ocr";

  message: string;
}

export async function retryFailedPdfIngestion(
  noteId: string,
  userId: string,
): Promise<RetryPdfIngestionResult> {
  // ─────────────────────────────────────────────────────────────
  // Note ownership
  // ─────────────────────────────────────────────────────────────

  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

  // ─────────────────────────────────────────────────────────────
  // Only PDFs can have OCR ingestion jobs.
  // ─────────────────────────────────────────────────────────────

  if (note.fileType !== "pdf") {
    throw new BadRequestError("OCR retry is only available for PDF documents.");
  }

  // ─────────────────────────────────────────────────────────────
  // Load BullMQ job
  // ─────────────────────────────────────────────────────────────

  const queue = getPdfIngestionQueue();

  const jobId = `pdf-ingest-${noteId}`;

  const job = await queue.getJob(jobId);

  if (!job) {
    throw new NotFoundError("PDF ingestion job");
  }

  // ─────────────────────────────────────────────────────────────
  // Security check
  //
  // Queue metadata must belong to the same authenticated user.
  // ─────────────────────────────────────────────────────────────

  if (job.data.userId !== userId) {
    logger.error("[pdf-retry] queue ownership mismatch", {
      noteId,

      authenticatedUserId: userId,

      queueUserId: job.data.userId,
    });

    throw new ForbiddenError();
  }

  const state = await job.getState();

  if (state !== "failed") {
    throw new BadRequestError(
      `PDF processing cannot be retried while the job is "${state}".`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // The provider-aware worker should have preserved this file
  // for quota/rate-limit/provider failures.
  // ─────────────────────────────────────────────────────────────

  const exists = await temporaryUploadExists(job.data.storageKey);

  if (!exists) {
    throw new BadRequestError(
      "The original PDF is no longer available. Please upload the document again.",
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Update UI state BEFORE putting job back into BullMQ.
  // ─────────────────────────────────────────────────────────────

  await generationRepo.updateStage(noteId, "vision_ocr");

  try {
    const retry = await retryPdfIngestion(noteId);

    logger.info("[pdf-retry] PDF ingestion retry requested", {
      noteId,

      userId,

      jobId: retry.jobId,

      storageKey: retry.storageKey,
    });

    return {
      noteId,

      jobId: retry.jobId,

      stage: "vision_ocr",

      message: "PDF text recovery has been queued again.",
    };
  } catch (error) {
    // Restore failed state if BullMQ retry itself failed.
    await generationRepo.updateStage(noteId, "failed");

    throw error;
  }
}

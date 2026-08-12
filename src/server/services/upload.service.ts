import path from "path";

import { FileError } from "@/server/utils/errors";

import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/server/utils/constants";

import {
  parsePDF,
  parseDOCX,
  type PdfExtractionQuality,
} from "@/server/services/pdf.service";

import { selectVisionPages } from "@/server/services/pdf-page-selection.service";

import { renderPdfPages } from "@/server/services/pdf-render.service";

import {
  reconstructPdfText,
  type ReconstructedPdf,
} from "@/server/services/pdf-reconstruction.service";

import { logger } from "@/server/utils/logger";

import type { FileType } from "@/server/entities/note.entity";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ProcessedFile {
  fileName: string;
  fileType: FileType;
  fileSize: number;

  /**
   * Canonical text that downstream intelligence should use.
   *
   * normal PDF:
   *   native text
   *
   * low-text PDF:
   *   native + OCR reconstruction
   *
   * image-heavy PDF:
   *   OCR-only text
   */
  content: string;

  /**
   * PDF only.
   */
  pageCount?: number;

  /**
   * Length of final canonical content.
   *
   * IMPORTANT:
   * This is NOT necessarily the same as the native PDF char count.
   */
  charCount: number;

  /**
   * PDF extraction diagnostics.
   */
  extractionQuality?: PdfExtractionQuality;

  /**
   * Native characters per page.
   *
   * This remains a diagnostic measurement of the
   * original/native PDF extraction.
   */
  charsPerPage?: number;

  /**
   * True when native PDF extraction quality was
   * insufficient and vision OCR was required.
   */
  requiresVisionFallback?: boolean;

  /**
   * True only when vision OCR actually executed
   * successfully.
   */
  visionFallbackUsed?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateFile(file: UploadedFile): void {
  // ─────────────────────────────────────────────────────────────
  // Size
  // ─────────────────────────────────────────────────────────────

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileError(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the ${
        MAX_FILE_SIZE_BYTES / 1024 / 1024
      }MB limit`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MIME type
  // ─────────────────────────────────────────────────────────────

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.mimeType as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new FileError(
      `File type "${file.mimeType}" is not supported. Allowed: PDF, DOCX`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Extension
  //
  // Protects against obvious MIME spoofing.
  // ─────────────────────────────────────────────────────────────

  const ext = path.extname(file.originalName).toLowerCase();

  if (
    !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])
  ) {
    throw new FileError(
      `File extension "${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(
        ", ",
      )}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filename sanitization
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 255);
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical PDF content
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide what text should be sent into the intelligence engine.
 *
 * NORMAL
 * ------
 * Native extraction is reliable.
 *
 * LOW-TEXT
 * --------
 * Native text may still contain useful headings / paragraphs,
 * therefore reconstruction keeps:
 *
 * native + vision recovered content
 *
 * IMAGE-HEAVY
 * -----------
 * Native extraction usually contains useless artifacts such as:
 *
 * -- 1 of 31 --
 * -- 2 of 31 --
 * ...
 *
 * Therefore OCR becomes the canonical document text.
 */
function selectCanonicalPdfContent(
  extractionQuality: PdfExtractionQuality,
  reconstructed: ReconstructedPdf,
): string {
  if (extractionQuality === "image-heavy") {
    const visionText = reconstructed.visionText?.trim();

    if (!visionText) {
      throw new FileError(
        "Image-heavy PDF vision processing completed but no readable OCR content was recovered.",
      );
    }

    return visionText;
  }

  const reconstructedText = reconstructed.text.trim();

  if (!reconstructedText) {
    throw new FileError(
      "PDF processing completed but no readable content was recovered.",
    );
  }

  return reconstructedText;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF processing
// ─────────────────────────────────────────────────────────────────────────────

async function processPdf(
  file: UploadedFile,
  fileName: string,
): Promise<ProcessedFile> {
  // ─────────────────────────────────────────────────────────────
  // Stage 1
  // Native PDF extraction
  // ─────────────────────────────────────────────────────────────

  const parsed = await parsePDF(file.buffer);

  logger.info("PDF native extraction completed", {
    fileName,

    pageCount: parsed.pageCount,

    charCount: parsed.charCount,

    charsPerPage: parsed.charsPerPage,

    extractionQuality: parsed.extractionQuality,

    requiresVisionFallback: parsed.requiresVisionFallback,
  });

  // ─────────────────────────────────────────────────────────────
  // Stage 2A
  // Native extraction is good enough
  // ─────────────────────────────────────────────────────────────

  if (!parsed.requiresVisionFallback) {
    return {
      fileName,

      fileType: "pdf",

      fileSize: file.size,

      content: parsed.text,

      pageCount: parsed.pageCount,

      charCount: parsed.text.length,

      extractionQuality: parsed.extractionQuality,

      charsPerPage: parsed.charsPerPage,

      requiresVisionFallback: false,

      visionFallbackUsed: false,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Stage 2B
  // Native extraction is insufficient
  //
  // low-text
  // → representative pages
  //
  // image-heavy
  // → every page
  // ─────────────────────────────────────────────────────────────

  const selectedPages = selectVisionPages(
    parsed.pageCount,
    parsed.extractionQuality,
  );

  logger.info("PDF vision fallback required", {
    fileName,

    pageCount: parsed.pageCount,

    extractionQuality: parsed.extractionQuality,

    selectedPageCount: selectedPages.length,

    selectedPages,
  });

  // ─────────────────────────────────────────────────────────────
  // Defensive check
  // ─────────────────────────────────────────────────────────────

  if (selectedPages.length === 0) {
    throw new FileError(
      "PDF requires vision fallback but no pages could be selected.",
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Stage 3
  // Render selected PDF pages
  // ─────────────────────────────────────────────────────────────

  const renderedPages = await renderPdfPages(file.buffer, selectedPages);

  if (renderedPages.length === 0) {
    throw new FileError(
      "PDF pages could not be rendered for vision processing.",
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Stage 4
  // OCR + reconstruction
  //
  // reconstructPdfText handles:
  //
  // 5-page OCR batching
  // timeout splitting
  // whitespace normalization
  // native + OCR combination
  // ─────────────────────────────────────────────────────────────

  const reconstructed = await reconstructPdfText({
    native: {
      text: parsed.text,

      pageCount: parsed.pageCount,
    },

    renderedPages,
  });

  // ─────────────────────────────────────────────────────────────
  // Stage 5
  // Sanity check
  // ─────────────────────────────────────────────────────────────

  if (!reconstructed.visionUsed) {
    throw new FileError(
      "PDF required vision fallback but vision processing did not run.",
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Stage 6
  // Choose canonical downstream content
  // ─────────────────────────────────────────────────────────────

  const finalContent = selectCanonicalPdfContent(
    parsed.extractionQuality,
    reconstructed,
  );

  // ─────────────────────────────────────────────────────────────
  // Logging
  // ─────────────────────────────────────────────────────────────

  logger.info("PDF vision reconstruction completed", {
    fileName,

    extractionQuality: parsed.extractionQuality,

    nativeCharCount: parsed.charCount,

    reconstructedCharCount: reconstructed.charCount,

    canonicalCharCount: finalContent.length,

    renderedPages: renderedPages.length,

    visionUsed: reconstructed.visionUsed,

    canonicalSource:
      parsed.extractionQuality === "image-heavy" ? "vision" : "native+vision",
  });

  // ─────────────────────────────────────────────────────────────
  // Final processed file
  // ─────────────────────────────────────────────────────────────

  return {
    fileName,

    fileType: "pdf",

    fileSize: file.size,

    content: finalContent,

    pageCount: parsed.pageCount,

    /**
     * IMPORTANT:
     *
     * This is now FINAL content length,
     * not native extraction length.
     */
    charCount: finalContent.length,

    extractionQuality: parsed.extractionQuality,

    /**
     * Keep native extraction measurement
     * for debugging/analytics.
     */
    charsPerPage: parsed.charsPerPage,

    requiresVisionFallback: true,

    visionFallbackUsed: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX processing
// ─────────────────────────────────────────────────────────────────────────────

async function processDocx(
  file: UploadedFile,
  fileName: string,
): Promise<ProcessedFile> {
  const parsed = await parseDOCX(file.buffer);

  return {
    fileName,

    fileType: "docx",

    fileSize: file.size,

    content: parsed.text,

    charCount: parsed.charCount,

    requiresVisionFallback: false,

    visionFallbackUsed: false,
  };
}

export async function inspectUpload(
  file: UploadedFile,
): Promise<UploadInspection> {
  validateFile(file);

  const fileName = sanitizeFileName(file.originalName);

  const ext = path.extname(file.originalName).toLowerCase();

  logger.info("Inspecting upload", {
    fileName,
    mimeType: file.mimeType,
    size: file.size,
  });

  // ─────────────────────────────────────────────────────────────
  // DOCX
  // ─────────────────────────────────────────────────────────────

  if (ext === ".docx") {
    const parsed = await parseDOCX(file.buffer);

    return {
      mode: "ready",

      processed: {
        fileName,

        fileType: "docx",

        fileSize: file.size,

        content: parsed.text,

        charCount: parsed.charCount,

        requiresVisionFallback: false,

        visionFallbackUsed: false,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PDF
  // ─────────────────────────────────────────────────────────────

  if (ext === ".pdf") {
    const parsed = await parsePDF(file.buffer);

    logger.info("PDF upload inspection completed", {
      fileName,

      pageCount: parsed.pageCount,

      charCount: parsed.charCount,

      charsPerPage: parsed.charsPerPage,

      extractionQuality: parsed.extractionQuality,

      requiresVisionFallback: parsed.requiresVisionFallback,
    });

    // Native PDF is already good.
    if (!parsed.requiresVisionFallback) {
      return {
        mode: "ready",

        processed: {
          fileName,

          fileType: "pdf",

          fileSize: file.size,

          content: parsed.text,

          pageCount: parsed.pageCount,

          charCount: parsed.text.length,

          extractionQuality: parsed.extractionQuality,

          charsPerPage: parsed.charsPerPage,

          requiresVisionFallback: false,

          visionFallbackUsed: false,
        },
      };
    }

    // Vision processing must move to BullMQ.
    if (
      parsed.extractionQuality !== "low-text" &&
      parsed.extractionQuality !== "image-heavy"
    ) {
      throw new FileError(
        "PDF requires vision fallback but extraction quality is invalid.",
      );
    }

    return {
      mode: "vision-required",

      fileName,

      fileType: "pdf",

      fileSize: file.size,

      nativeText: parsed.text,

      pageCount: parsed.pageCount,

      nativeCharCount: parsed.charCount,

      extractionQuality: parsed.extractionQuality,

      charsPerPage: parsed.charsPerPage,
    };
  }

  throw new FileError("Unsupported file type");
}
// ─────────────────────────────────────────────────────────────────────────────
// Main upload processor
// ─────────────────────────────────────────────────────────────────────────────

export async function processUpload(
  file: UploadedFile,
): Promise<ProcessedFile> {
  validateFile(file);

  const fileName = sanitizeFileName(file.originalName);

  const ext = path.extname(file.originalName).toLowerCase();

  logger.info("Processing upload", {
    fileName,

    mimeType: file.mimeType,

    size: file.size,
  });

  // ─────────────────────────────────────────────────────────────
  // PDF
  // ─────────────────────────────────────────────────────────────

  if (ext === ".pdf") {
    return processPdf(file, fileName);
  }

  // ─────────────────────────────────────────────────────────────
  // DOCX
  // ─────────────────────────────────────────────────────────────

  if (ext === ".docx") {
    return processDocx(file, fileName);
  }

  // validateFile should prevent
  // reaching this branch.
  throw new FileError("Unsupported file type");
}

// ─────────────────────────────────────────────────────────────────────────────
// Multipart request extraction
// ─────────────────────────────────────────────────────────────────────────────

export async function extractFileFromRequest(
  req: Request,
): Promise<UploadedFile> {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    throw new FileError("Request must be multipart/form-data");
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    throw new FileError("No file found — field must be named 'file'");
  }

  if (file.size === 0) {
    throw new FileError("Uploaded file is empty");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    buffer,

    originalName: file.name,

    mimeType: file.type,

    size: file.size,
  };
}

export interface VisionUploadInspection {
  mode: "vision-required";

  fileName: string;
  fileType: "pdf";
  fileSize: number;

  nativeText: string;

  pageCount: number;
  nativeCharCount: number;

  extractionQuality: "low-text" | "image-heavy";

  charsPerPage: number;
}

export interface ReadyUploadInspection {
  mode: "ready";
  processed: ProcessedFile;
}

export type UploadInspection = ReadyUploadInspection | VisionUploadInspection;

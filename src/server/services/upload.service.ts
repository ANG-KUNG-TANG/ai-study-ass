import { FileError, PayloadTooLargeError } from "@/server/utils/errors";
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_UPLOAD_REQUEST_SIZE_BYTES,
} from "@/server/utils/constants";
import { parsePDF, parseDOCX } from "@/server/services/pdf.service";
import { logger } from "@/server/utils/logger";
import type { FileType } from "@/server/entities/note.entity";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  content: string; // extracted text
  pageCount?: number; // PDF only
  charCount: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFile(file: UploadedFile): void {
  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileError(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`,
    );
  }

  // MIME type check
  if (
    !ALLOWED_MIME_TYPES.includes(
      file.mimeType as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new FileError(
      `File type "${file.mimeType}" is not supported. Allowed: PDF, DOCX`,
    );
  }

  // Extension check — guards against MIME spoofing
  const ext = path.extname(file.originalName).toLowerCase();
  if (
    !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])
  ) {
    throw new FileError(
      `File extension "${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_") // replace unsafe chars
    .replace(/_{2,}/g, "_") // collapse multiple underscores
    .slice(0, 255); // enforce max length
}

// ─── Process ──────────────────────────────────────────────────────────────────
// Validates the file, routes to the correct parser, returns extracted content.

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

  if (ext === ".pdf") {
    const parsed = await parsePDF(file.buffer);
    return {
      fileName,
      fileType: "pdf",
      fileSize: file.size,
      content: parsed.text,
      pageCount: parsed.pageCount,
      charCount: parsed.charCount,
    };
  }

  if (ext === ".docx") {
    const parsed = await parseDOCX(file.buffer);
    return {
      fileName,
      fileType: "docx",
      fileSize: file.size,
      content: parsed.text,
      charCount: parsed.charCount,
    };
  }

  // Should never reach here — validateFile catches unsupported types
  throw new FileError("Unsupported file type");
}

// ─── Parse multipart form data ────────────────────────────────────────────────
// Extracts the uploaded file from a Next.js Request.
// Next.js App Router doesn't have built-in multipart parsing — uses FormData API.

function uploadSizeMessage(bytes: number): string {
  return `Upload exceeds the ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(
    0,
  )}MB file limit (${(bytes / 1024 / 1024).toFixed(1)}MB received)`;
}

async function readRequestBodyWithLimit(req: Request): Promise<Buffer> {
  const declaredLength = req.headers.get("content-length");

  if (declaredLength) {
    const parsedLength = Number(declaredLength);

    if (
      Number.isFinite(parsedLength) &&
      parsedLength > MAX_UPLOAD_REQUEST_SIZE_BYTES
    ) {
      throw new PayloadTooLargeError(uploadSizeMessage(parsedLength));
    }
  }

  if (!req.body) {
    throw new FileError("Upload request body is empty");
  }

  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_UPLOAD_REQUEST_SIZE_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError(uploadSizeMessage(totalBytes));
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

export async function extractFileFromRequest(
  req: Request,
): Promise<UploadedFile> {
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new FileError("Request must be multipart/form-data");
  }

  const boundedBody = await readRequestBodyWithLimit(req);

  let formData: FormData;

  try {
    const requestBody = Uint8Array.from(boundedBody).buffer;

    const boundedRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: requestBody,
    });

    formData = await boundedRequest.formData();
  } catch {
    throw new FileError("Request must contain valid multipart/form-data");
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    throw new FileError("No file found — field must be named 'file'");
  }

  if (file.size === 0) {
    throw new FileError("Uploaded file is empty");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PayloadTooLargeError(uploadSizeMessage(file.size));
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    buffer,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

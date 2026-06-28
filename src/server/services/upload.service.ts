import { FileError } from "@/server/utils/errors";
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
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
  content: string;        // extracted text
  pageCount?: number;     // PDF only
  charCount: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFile(file: UploadedFile): void {
  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileError(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`
    );
  }

  // MIME type check
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType as typeof ALLOWED_MIME_TYPES[number])) {
    throw new FileError(
      `File type "${file.mimeType}" is not supported. Allowed: PDF, DOCX`
    );
  }

  // Extension check — guards against MIME spoofing
  const ext = path.extname(file.originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
    throw new FileError(
      `File extension "${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
    );
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")  // replace unsafe chars
    .replace(/_{2,}/g, "_")              // collapse multiple underscores
    .slice(0, 255);                      // enforce max length
}

// ─── Process ──────────────────────────────────────────────────────────────────
// Validates the file, routes to the correct parser, returns extracted content.

export async function processUpload(file: UploadedFile): Promise<ProcessedFile> {
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

export async function extractFileFromRequest(req: Request): Promise<UploadedFile> {
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
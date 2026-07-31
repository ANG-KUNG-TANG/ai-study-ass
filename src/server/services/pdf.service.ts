// src/server/services/pdf.service.ts
import { FileError } from "@/server/utils/errors";
import { MAX_CONTENT_LENGTH } from "@/server/utils/constants";
import { logger } from "@/server/utils/logger";

// ─── PDF Parser ───────────────────────────────────────────────────────────────
// Extracts raw text from a PDF buffer using pdf-parse v2 (class-based API).
// v2 is a full rewrite of v1 — it is NOT a callable function anymore:
//   const { PDFParse } = require("pdf-parse");
//   const parser = new PDFParse({ data: buffer });   // buffer goes in the constructor
//   const result = await parser.getText();            // getText() takes ParseParameters, not a buffer
//   await parser.destroy();                            // always free worker/memory resources
// install: npm install pdf-parse   (v2.x — this file does not support pdf-parse v1)

interface ParsedPDF {
  text: string;
  pageCount: number;
  charCount: number;
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  let PDFParse: any;
  let PasswordException: any;

  try {
    // require, not dynamic import — pdf-parse is CJS and Next's webpack
    // interop for `import()` on this package doesn't reliably yield the
    // callable exports. Requires serverExternalPackages: ["pdf-parse"]
    // in next.config.ts so webpack doesn't try to bundle it at all.
    const mod = require("pdf-parse");
    PDFParse = mod.PDFParse;
    PasswordException = mod.PasswordException;

    if (typeof PDFParse !== "function") {
      throw new Error(
        `pdf-parse export missing PDFParse class — got keys: ${Object.keys(mod).join(", ")}. ` +
          `This file targets pdf-parse v2.x; check your installed version.`
      );
    }
  } catch (err) {
    logger.error("pdf-parse could not be resolved to the v2 PDFParse class", {
      message: err instanceof Error ? err.message : String(err),
    });
    throw new FileError("PDF parser not available — check pdf-parse installation/version");
  }

  // Buffer is passed to the constructor, not to getText(). getText() itself
  // takes a ParseParameters options object (e.g. { partial: [1,2] }), so
  // passing the buffer there is what produces the earlier "verbosity" crash —
  // pdf-parse tries to read config fields off the buffer.
  const parser = new PDFParse({ data: buffer });

  let result: { text: string; total?: number };

  try {
    result = await parser.getText();
  } catch (err) {
    const isPasswordProtected =
      (PasswordException && err instanceof PasswordException) ||
      (err instanceof Error && err.name === "PasswordException");

    if (isPasswordProtected) {
      throw new FileError("PDF is password-protected — please remove the password and re-upload");
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    throw new FileError(`Failed to parse PDF: ${message}`);
  } finally {
    // Always release the underlying pdfjs-dist worker/document, even on failure.
    try {
      await parser.destroy();
    } catch (destroyErr) {
      logger.warn("pdf-parse: failed to destroy parser instance", {
        message: destroyErr instanceof Error ? destroyErr.message : String(destroyErr),
      });
    }
  }

  const rawText = result.text ?? "";

  if (!rawText.trim()) {
    throw new FileError("PDF appears to contain no extractable text — it may be a scanned image");
  }

  const cleaned = cleanText(rawText);

  const text = cleaned.length > MAX_CONTENT_LENGTH
    ? cleaned.slice(0, MAX_CONTENT_LENGTH)
    : cleaned;

  if (cleaned.length > MAX_CONTENT_LENGTH) {
    logger.warn("PDF content truncated", {
      original: cleaned.length,
      limit: MAX_CONTENT_LENGTH,
    });
  }

  return {
    text,
    pageCount: result.total ?? 0,
    charCount: text.length,
  };
}

// ─── DOCX Parser ──────────────────────────────────────────────────────────────
// Unchanged — mammoth's ESM/CJS interop is reliable, not implicated in this bug.

interface ParsedDOCX {
  text: string;
  charCount: number;
}

export async function parseDOCX(buffer: Buffer): Promise<ParsedDOCX> {
  let mammoth: typeof import("mammoth");

  try {
    mammoth = await import("mammoth");
  } catch {
    throw new FileError("DOCX parser not available — run: npm install mammoth");
  }

  let result: { value: string; messages: unknown[] };

  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    throw new FileError(
      `Failed to parse DOCX: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  const rawText = result.value ?? "";

  if (!rawText.trim()) {
    throw new FileError("Document appears to be empty");
  }

  const cleaned = cleanText(rawText);

  const text = cleaned.length > MAX_CONTENT_LENGTH
    ? cleaned.slice(0, MAX_CONTENT_LENGTH)
    : cleaned;

  if (cleaned.length > MAX_CONTENT_LENGTH) {
    logger.warn("DOCX content truncated", {
      original: cleaned.length,
      limit: MAX_CONTENT_LENGTH,
    });
  }

  return { text, charCount: text.length };
}

// ─── Text cleaner ─────────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
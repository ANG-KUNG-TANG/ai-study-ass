import { FileError } from "@/server/utils/errors";
import { MAX_CONTENT_LENGTH } from "@/server/utils/constants";
import { logger } from "@/server/utils/logger";

interface ParsedPDF {
  text: string;
  pageCount: number;
  charCount: number;

  extractionQuality: PdfExtractionQuality;
  charsPerPage: number;
  requiresVisionFallback: boolean;
}

export type PdfExtractionQuality = "normal" | "low-text" | "image-heavy";

export interface PdfExtractionAnalysis {
  quality: PdfExtractionQuality;
  charsPerPage: number;
  requiresVisionFallback: boolean;
}
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  let PDFParse: (typeof import("pdf-parse"))["PDFParse"] | undefined;

  let PasswordException:
    | (typeof import("pdf-parse"))["PasswordException"]
    | undefined;

  let CanvasFactory:
    | (typeof import("pdf-parse/worker"))["CanvasFactory"]
    | undefined;

  try {
    const worker = await import("pdf-parse/worker");

    CanvasFactory = worker.CanvasFactory;

    const pdfModule = await import("pdf-parse");

    PDFParse = pdfModule.PDFParse;
    PasswordException = pdfModule.PasswordException;

    if (typeof PDFParse !== "function" || !CanvasFactory) {
      throw new Error("PDFParse or CanvasFactory is unavailable");
    }
  } catch (error) {
    logger.error("pdf-parse initialization failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    throw new FileError(
      "PDF parser not available — check pdf-parse/canvas installation",
    );
  }

  const parser = new PDFParse({
    data: buffer,
    CanvasFactory,
  });

  let result: {
    text: string;
    total?: number;
  };

  try {
    result = await parser.getText();
  } catch (error) {
    const isPasswordProtected =
      PasswordException && error instanceof PasswordException;

    if (
      isPasswordProtected ||
      (error instanceof Error && error.name === "PasswordException")
    ) {
      throw new FileError(
        "PDF is password-protected — please remove the password and re-upload",
      );
    }

    throw new FileError(
      `Failed to parse PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  } finally {
    try {
      await parser.destroy();
    } catch (error) {
      logger.warn("pdf-parse: failed to destroy parser instance", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ------------------------------------------------------------
  // Native extraction
  // ------------------------------------------------------------

  const rawText = result.text ?? "";

  // Important:
  // an empty native result is NOT automatically an error anymore.
  // It can be a scanned/image-based PDF and should go to vision.
  const cleaned = rawText.trim() ? cleanText(rawText) : "";

  const pageCount = result.total ?? 0;

  const extraction = analysePdfExtraction(pageCount, cleaned.length);

  if (extraction.requiresVisionFallback) {
    logger.warn("PDF requires vision fallback", {
      pageCount,
      charCount: cleaned.length,

      charsPerPage: Math.round(extraction.charsPerPage * 100) / 100,

      extractionQuality: extraction.quality,

      requiresVisionFallback: true,
    });
  } else {
    logger.info("PDF native extraction is sufficient", {
      pageCount,
      charCount: cleaned.length,

      charsPerPage: Math.round(extraction.charsPerPage * 100) / 100,

      extractionQuality: extraction.quality,

      requiresVisionFallback: false,
    });
  }

  // ------------------------------------------------------------
  // Content limit
  // ------------------------------------------------------------

  const text =
    cleaned.length > MAX_CONTENT_LENGTH
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
    pageCount,
    charCount: text.length,

    extractionQuality: extraction.quality,

    charsPerPage: extraction.charsPerPage,

    requiresVisionFallback: extraction.requiresVisionFallback,
  };
}
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

  let result: {
    value: string;
    messages: unknown[];
  };

  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (error: unknown) {
    throw new FileError(
      `Failed to parse DOCX: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }

  const rawText = result.value ?? "";

  if (!rawText.trim()) {
    throw new FileError("Document appears to be empty");
  }

  const text = cleanText(rawText);

  return {
    text,
    charCount: text.length,
  };
}
export function analysePdfExtraction(
  pageCount: number,
  charCount: number,
): PdfExtractionAnalysis {
  const safePageCount = Math.max(pageCount, 1);

  const safeCharCount = Math.max(charCount, 0);

  const charsPerPage = safeCharCount / safePageCount;

  // ─────────────────────────────────────────────────────────────
  // Image-heavy / scanned PDF
  //
  // IMPORTANT:
  // Do NOT require 3+ pages.
  //
  // A 1-page or 2-page scanned PDF still needs OCR.
  // ─────────────────────────────────────────────────────────────

  if (safeCharCount === 0 || charsPerPage < 40) {
    return {
      quality: "image-heavy",

      charsPerPage,

      requiresVisionFallback: true,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Low-text PDF
  //
  // Some native text exists, but not enough to trust as the
  // complete document.
  // ─────────────────────────────────────────────────────────────

  if (charsPerPage < 120) {
    return {
      quality: "low-text",

      charsPerPage,

      requiresVisionFallback: true,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Native extraction is sufficient
  // ─────────────────────────────────────────────────────────────

  return {
    quality: "normal",

    charsPerPage,

    requiresVisionFallback: false,
  };
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

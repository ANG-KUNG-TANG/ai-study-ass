import { FileError } from "@/server/utils/errors";
import { MAX_CONTENT_LENGTH } from "@/server/utils/constants";
import { logger } from "@/server/utils/logger";

interface ParsedPDF {
  text: string;
  pageCount: number;
  charCount: number;
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
    // Important:
    // load the worker/canvas implementation BEFORE pdf-parse.
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

  const rawText = result.text ?? "";

  if (!rawText.trim()) {
    throw new FileError(
      "PDF appears to contain no extractable text — it may be a scanned image",
    );
  }

  const cleaned = cleanText(rawText);
  
  const pageCount = result.total ?? 0;

  const averageCharsPerPage =
    pageCount > 0 ? cleaned.length / pageCount : cleaned.length;

  const looksLikeLowTextPdf =
    pageCount >= 5 &&
    cleaned.length < 1000 &&
    averageCharsPerPage < 40;

  if (looksLikeLowTextPdf) {
    logger.warn("PDF has insufficient extractable text", {
      pageCount,
      charCount: cleaned.length,
      averageCharsPerPage: Math.round(averageCharsPerPage),
    });

    throw new FileError(
      "This PDF contains too little extractable text to generate reliable study materials. It may be scanned or image-based. Please upload a text-based PDF.",
    );
  }

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
    pageCount: result.total ?? 0,
    charCount: text.length,
  };
}

interface ParsedDOCX {
  text: string;
  charCount: number;
}

export async function parseDOCX(
  buffer: Buffer,
): Promise<ParsedDOCX> {
  let mammoth: typeof import("mammoth");

  try {
    mammoth = await import("mammoth");
  } catch {
    throw new FileError(
      "DOCX parser not available — run: npm install mammoth",
    );
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

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


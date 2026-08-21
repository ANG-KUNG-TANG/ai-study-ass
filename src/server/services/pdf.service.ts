import { FileError } from "@/server/utils/errors";
import {
  MAX_CONTENT_LENGTH,
  MAX_DOCX_UNCOMPRESSED_BYTES,
  MAX_DOCX_ZIP_ENTRIES,
  MAX_PDF_PAGES,
} from "@/server/utils/constants";
import { logger } from "@/server/utils/logger";

function limitExtractedText(
  text: string,
  label: "PDF" | "DOCX",
): string {
  if (text.length <= MAX_CONTENT_LENGTH) {
    return text;
  }

  logger.warn(`${label} content truncated`, {
    original: text.length,
    limit: MAX_CONTENT_LENGTH,
  });

  return text.slice(0, MAX_CONTENT_LENGTH);
}

function validateDocxArchiveLimits(buffer: Buffer): void {
  const eocdSignature = Buffer.from([
    0x50,
    0x4b,
    0x05,
    0x06,
  ]);
  const minEocdSize = 22;
  const maxCommentLength = 65_535;
  const searchStart = Math.max(
    0,
    buffer.length - minEocdSize - maxCommentLength,
  );
  const eocdOffset = buffer.lastIndexOf(eocdSignature);

  if (
    eocdOffset < searchStart ||
    eocdOffset + minEocdSize > buffer.length
  ) {
    throw new FileError("Invalid DOCX ZIP directory");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(
    eocdOffset + 12,
  );
  const centralDirectoryOffset = buffer.readUInt32LE(
    eocdOffset + 16,
  );

  if (entryCount > MAX_DOCX_ZIP_ENTRIES) {
    throw new FileError(
      `DOCX contains too many ZIP entries (${entryCount}; maximum ${MAX_DOCX_ZIP_ENTRIES})`,
    );
  }

  if (
    centralDirectoryOffset + centralDirectorySize >
    buffer.length
  ) {
    throw new FileError("Invalid DOCX ZIP directory bounds");
  }

  let cursor = centralDirectoryOffset;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      cursor + 46 > buffer.length ||
      buffer.readUInt32LE(cursor) !== 0x02014b50
    ) {
      throw new FileError(
        "Invalid DOCX ZIP central directory",
      );
    }

    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(
      cursor + 24,
    );

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff
    ) {
      throw new FileError(
        "ZIP64 DOCX files are not supported",
      );
    }

    totalUncompressedBytes += uncompressedSize;

    if (
      totalUncompressedBytes >
      MAX_DOCX_UNCOMPRESSED_BYTES
    ) {
      throw new FileError(
        `DOCX expands beyond the ${Math.floor(
          MAX_DOCX_UNCOMPRESSED_BYTES / 1024 / 1024,
        )}MB processing limit`,
      );
    }

    const fileNameLength = buffer.readUInt16LE(
      cursor + 28,
    );
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(
      cursor + 32,
    );

    cursor +=
      46 +
      fileNameLength +
      extraLength +
      commentLength;

    if (
      cursor >
      centralDirectoryOffset + centralDirectorySize
    ) {
      throw new FileError(
        "Invalid DOCX ZIP central directory size",
      );
    }
  }
}

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
    const info = await parser.getInfo();
    const pageCount = info.total ?? 0;

    if (pageCount > MAX_PDF_PAGES) {
      throw new FileError(
        `PDF has ${pageCount} pages; maximum supported is ${MAX_PDF_PAGES}`,
      );
    }

    result = await parser.getText();
  } catch (error) {
    if (error instanceof FileError) {
      throw error;
    }

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
  const text = limitExtractedText(cleaned, "PDF");

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
  validateDocxArchiveLimits(buffer);

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

  const cleaned = cleanText(rawText);
  const text = limitExtractedText(cleaned, "DOCX");

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

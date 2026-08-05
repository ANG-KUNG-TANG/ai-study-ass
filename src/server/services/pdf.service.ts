import { createRequire } from "node:module";

import { FileError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

const loadCommonJsModule = createRequire(import.meta.url);

interface ParsedPDF {
  text: string;
  pageCount: number;
  charCount: number;
  pages?: Array<{ pageNumber: number; text: string }>;
}

interface PDFTextResult {
  text?: string;
  total?: number;
  pages?: Array<{ text?: string }>;
}

interface PDFParserInstance {
  getText(): Promise<PDFTextResult>;
  destroy(): Promise<void> | void;
}

type PDFParserConstructor = new (options: {
  data: Uint8Array;
}) => PDFParserInstance;

type PasswordErrorConstructor = new (...args: never[]) => Error;

interface PDFParseModule {
  PDFParse?: PDFParserConstructor;
  PasswordException?: PasswordErrorConstructor;
}

function loadPDFParse(): {
  PDFParse: PDFParserConstructor;
  PasswordException?: PasswordErrorConstructor;
} {
  try {
    const loaded = loadCommonJsModule("pdf-parse") as unknown;
    const pdfParseModule = loaded as PDFParseModule;

    if (typeof pdfParseModule.PDFParse !== "function") {
      const keys =
        loaded && typeof loaded === "object"
          ? Object.keys(loaded as Record<string, unknown>)
          : [];

      throw new Error(
        `pdf-parse export missing PDFParse class — got keys: ${keys.join(", ")}`,
      );
    }

    return {
      PDFParse: pdfParseModule.PDFParse,
      PasswordException: pdfParseModule.PasswordException,
    };
  } catch (unknownError: unknown) {
    logger.error("pdf-parse could not be resolved to the v2 PDFParse class", {
      message:
        unknownError instanceof Error
          ? unknownError.message
          : String(unknownError),
    });

    throw new FileError(
      "PDF parser not available — check pdf-parse installation/version",
    );
  }
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const {
    PDFParse,
    PasswordException,
  } = loadPDFParse();

  const parser = new PDFParse({
    data: buffer,
  });

  let result: PDFTextResult;

  try {
    result = await parser.getText();
  } catch (unknownError: unknown) {
    const isPasswordProtected =
      Boolean(
        PasswordException &&
          unknownError instanceof PasswordException,
      ) ||
      (unknownError instanceof Error &&
        unknownError.name === "PasswordException");

    if (isPasswordProtected) {
      throw new FileError(
        "PDF is password-protected — please remove the password and re-upload",
      );
    }

    const message =
      unknownError instanceof Error
        ? unknownError.message
        : "Unknown error";

    throw new FileError(`Failed to parse PDF: ${message}`);
  } finally {
    try {
      await parser.destroy();
    } catch (destroyError: unknown) {
      logger.warn("pdf-parse: failed to destroy parser instance", {
        message:
          destroyError instanceof Error
            ? destroyError.message
            : String(destroyError),
      });
    }
  }

  const rawText = result.text ?? "";

  if (!rawText.trim()) {
    throw new FileError(
      "PDF appears to contain no extractable text — it may be a scanned image",
    );
  }

  const text = cleanText(rawText);
  const pages = Array.isArray(result.pages)
    ? result.pages
        .map((page, index) => ({
          pageNumber: index + 1,
          text: cleanText(page.text ?? ""),
        }))
        .filter((page) => page.text.length > 0)
    : undefined;

  return {
    text,
    pageCount: result.total ?? pages?.length ?? 0,
    charCount: text.length,
    pages,
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
  } catch (unknownError: unknown) {
    throw new FileError(
      `Failed to parse DOCX: ${
        unknownError instanceof Error
          ? unknownError.message
          : "Unknown error"
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

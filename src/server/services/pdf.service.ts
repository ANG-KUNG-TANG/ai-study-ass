import { FileError } from "@/server/utils/errors";
import { MAX_CONTENT_LENGTH } from "@/server/utils/constants";
import { logger } from "@/server/utils/logger";

// ─── PDF Parser ───────────────────────────────────────────────────────────────
// Extracts raw text from a PDF buffer using pdf-parse.
// Returns cleaned text + page count metadata.
// install: npm install pdf-parse
// install: npm install -D @types/pdf-parse

interface ParsedPDF {
  text: string;
  pageCount: number;
  charCount: number;
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  let pdfParse: typeof import("pdf-parse");

  try {
    pdfParse = (await import("pdf-parse")).default;
  } catch {
    throw new FileError("PDF parser not available — run: npm install pdf-parse");
  }

  let result: Awaited<ReturnType<typeof pdfParse>>;

  try {
    result = await pdfParse(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Encrypted PDFs throw a specific error
    if (message.toLowerCase().includes("encrypted")) {
      throw new FileError("PDF is password-protected — please remove the password and re-upload");
    }

    throw new FileError(`Failed to parse PDF: ${message}`);
  }

  const rawText = result.text ?? "";

  if (!rawText.trim()) {
    throw new FileError("PDF appears to contain no extractable text — it may be a scanned image");
  }

  // Clean extracted text
  const cleaned = cleanText(rawText);

  // Truncate if over the content limit
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
    pageCount: result.numpages ?? 0,
    charCount: text.length,
  };
}

// ─── DOCX Parser ──────────────────────────────────────────────────────────────
// Extracts raw text from a DOCX buffer using mammoth.
// install: npm install mammoth

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
// Normalises whitespace extracted from documents.

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")         // normalise line endings
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")            // tabs to spaces
    .replace(/[ ]{2,}/g, " ")       // collapse multiple spaces
    .replace(/\n{3,}/g, "\n\n")     // max two consecutive newlines
    .trim();
}
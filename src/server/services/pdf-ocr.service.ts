import {
  generateFromImages,
  type VisionImage,
} from "@/server/services/vision.service";

import { FileError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

export interface RenderedPdfPage {
  pageNumber: number;
  buffer: Buffer;
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
}

export interface PDFOCRResult {
  text: string;
  pages: OCRPageResult[];

  provider: "openai" | "gemini";
  model: string;

  processedPages: number;
  charCount: number;
}

const MAX_OCR_PAGES_PER_REQUEST = 5;

function cleanOCRText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildOCRPrompt(pages: RenderedPdfPage[]): string {
  const pageNumbers = pages.map((page) => page.pageNumber).join(", ");

  return `
You are extracting text from rendered pages of an academic PDF.

The supplied images represent PDF pages:
${pageNumbers}

Your job is OCR and document reconstruction.

Rules:

1. Extract all clearly visible educational text.
2. Preserve headings, subheadings and bullet points.
3. Preserve important labels from diagrams and charts.
4. Preserve code, formulas and technical terminology when readable.
5. Do not summarize.
6. Do not explain the document.
7. Do not invent text that is not visible.
8. If some text is unreadable, omit it rather than guessing.
9. Keep each page separate.

Return exactly this structure:

--- PAGE <page number> ---
<extracted text>

--- PAGE <page number> ---
<extracted text>
`.trim();
}

function parsePageSections(
  text: string,
  requestedPages: RenderedPdfPage[],
): OCRPageResult[] {
  const normalized = text.trim();

  const marker =
    /---\s*PAGE\s+(\d+)\s*---([\s\S]*?)(?=---\s*PAGE\s+\d+\s*---|$)/gi;

  const pages: OCRPageResult[] = [];

  let match: RegExpExecArray | null;

  while ((match = marker.exec(normalized)) !== null) {
    const pageNumber = Number.parseInt(match[1], 10);

    const pageText = cleanOCRText(match[2]);

    if (Number.isInteger(pageNumber) && pageText.length > 0) {
      pages.push({
        pageNumber,
        text: pageText,
      });
    }
  }

  /*
   * Provider occasionally ignores formatting.
   * For a single rendered page we can still safely associate
   * the complete output with that page.
   */
  if (
    pages.length === 0 &&
    requestedPages.length === 1 &&
    normalized.length > 0
  ) {
    return [
      {
        pageNumber: requestedPages[0].pageNumber,
        text: cleanOCRText(normalized),
      },
    ];
  }

  return pages;
}

export async function extractTextFromRenderedPages(
  renderedPages: RenderedPdfPage[],
): Promise<PDFOCRResult> {
  if (renderedPages.length === 0) {
    throw new FileError("No rendered PDF pages were supplied for OCR.");
  }

  if (renderedPages.length > MAX_OCR_PAGES_PER_REQUEST) {
    throw new FileError(
      `OCR currently supports up to ${MAX_OCR_PAGES_PER_REQUEST} pages per request.`,
    );
  }

  for (const page of renderedPages) {
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
      throw new FileError(`Invalid PDF page number: ${page.pageNumber}`);
    }

    if (page.buffer.length === 0) {
      throw new FileError(`Rendered PDF page ${page.pageNumber} is empty.`);
    }
  }

  const images: VisionImage[] = renderedPages.map((page) => ({
    buffer: page.buffer,
    mimeType: page.mimeType ?? "image/png",
  }));

  logger.info("[pdf-ocr] vision extraction started", {
    pages: renderedPages.map((page) => page.pageNumber),
  });

  const result = await generateFromImages({
    prompt: buildOCRPrompt(renderedPages),
    images,
    maxTokens: 5_000,
  });

  const pages = parsePageSections(result.text, renderedPages);

  if (pages.length === 0) {
    throw new FileError(
      "Vision processing completed but no readable text was recovered.",
    );
  }

  const combinedText = pages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  logger.info("[pdf-ocr] vision extraction completed", {
    provider: result.provider,
    model: result.model,
    requestedPages: renderedPages.length,
    extractedPages: pages.length,
    charCount: combinedText.length,
  });

  return {
    text: combinedText,
    pages,

    provider: result.provider,
    model: result.model,

    processedPages: pages.length,
    charCount: combinedText.length,
  };
}

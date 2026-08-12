import { extractTextFromRenderedPages } from "@/server/services/pdf-ocr.service";
import { FileError } from "@/server/utils/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NativePdfExtraction {
  text: string;
  pageCount: number;
}

export interface RenderedPdfPage {
  pageNumber: number;
  buffer: Buffer;
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
}

export interface ReconstructPdfInput {
  native: NativePdfExtraction;
  renderedPages: RenderedPdfPage[];
}

export interface ReconstructedPdf {
  text: string;
  nativeText: string;
  visionText: string | null;
  visionUsed: boolean;
  charCount: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * pdf-ocr.service.ts supports a maximum of 5 pages per request.
 *
 * Larger documents are divided into multiple OCR requests.
 */
const OCR_BATCH_SIZE = 5;

// ─── Text normalization ───────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function isVisionTimeout(error: unknown): boolean {
  return error instanceof Error && /timed out|timeout/i.test(error.message);
}

// ─── Adaptive OCR batching ────────────────────────────────────────────────────

/**
 * Extract text from a batch of rendered PDF pages.
 *
 * Normal path:
 *
 * 5 pages
 *   ↓
 * single OCR call
 *
 * Timeout path:
 *
 * 5 pages
 *   ↓ timeout
 * 3 pages + 2 pages
 *
 * If one of those still times out:
 *
 * 3 pages
 *   ↓ timeout
 * 2 pages + 1 page
 *
 * This makes large image-heavy PDFs more resilient to
 * provider latency without increasing the global AI timeout.
 */
async function extractBatchWithFallback(
  pages: RenderedPdfPage[],
): Promise<string[]> {
  try {
    const result = await extractTextFromRenderedPages(pages);

    const text = normalizeText(result.text);

    return text ? [text] : [];
  } catch (error) {
    // Do not hide real provider/OCR errors.
    //
    // Only timeout errors receive the
    // smaller-batch retry behavior.
    if (!isVisionTimeout(error)) {
      throw error;
    }

    // One page is already the smallest
    // possible OCR request.
    if (pages.length === 1) {
      throw error;
    }

    const midpoint = Math.ceil(pages.length / 2);

    const leftPages = pages.slice(0, midpoint);

    const rightPages = pages.slice(midpoint);

    const leftText = await extractBatchWithFallback(leftPages);

    const rightText = await extractBatchWithFallback(rightPages);

    return [...leftText, ...rightText];
  }
}

// ─── Reconstruction ───────────────────────────────────────────────────────────

export async function reconstructPdfText(
  input: ReconstructPdfInput,
): Promise<ReconstructedPdf> {
  const nativeText = normalizeText(input.native.text);

  // ─────────────────────────────────────────────────────────────
  // No rendered pages means native extraction
  // was already sufficient.
  // ─────────────────────────────────────────────────────────────

  if (input.renderedPages.length === 0) {
    return {
      text: nativeText,
      nativeText,
      visionText: null,
      visionUsed: false,
      charCount: nativeText.length,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Vision extraction
  //
  // Large documents are processed in normal
  // 5-page batches.
  // ─────────────────────────────────────────────────────────────

  const visionParts: string[] = [];

  for (
    let index = 0;
    index < input.renderedPages.length;
    index += OCR_BATCH_SIZE
  ) {
    const batch = input.renderedPages.slice(index, index + OCR_BATCH_SIZE);

    const extracted = await extractBatchWithFallback(batch);

    visionParts.push(...extracted);
  }

  // ─────────────────────────────────────────────────────────────
  // Combine all OCR batches
  // ─────────────────────────────────────────────────────────────

  const visionText = normalizeText(visionParts.join("\n\n"));

  if (!visionText) {
    throw new FileError(
      "Vision OCR completed but no readable text was recovered.",
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Native + recovered visual content
  // ─────────────────────────────────────────────────────────────

  const combined = normalizeText(
    [nativeText, "", "--- VISION RECOVERED CONTENT ---", visionText].join("\n"),
  );

  return {
    text: combined,

    nativeText,
    visionText,

    visionUsed: true,

    charCount: combined.length,
  };
}

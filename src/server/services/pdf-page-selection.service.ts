import type { PdfExtractionQuality } from "@/server/services/pdf.service";

const DEFAULT_SAMPLE_LIMIT = 8;

const MAX_FULL_VISION_PAGES = 50;

export interface VisionPageSelectionInput {
  pageCount: number;
  extractionQuality: PdfExtractionQuality;
}

export function selectVisionPages(
  pageCount: number,
  extractionQuality: PdfExtractionQuality = "low-text",
): number[] {
  if (pageCount <= 0) {
    return [];
  }

  // ==========================================================
  // IMAGE-HEAVY
  //
  // Native extraction cannot represent the document reliably.
  // OCR every page.
  // ==========================================================

  if (extractionQuality === "image-heavy") {
    const count = Math.min(pageCount, MAX_FULL_VISION_PAGES);

    return Array.from({ length: count }, (_, index) => index + 1);
  }

  // ==========================================================
  // SMALL DOCUMENT
  //
  // Cheap enough to process every page.
  // ==========================================================

  if (pageCount <= DEFAULT_SAMPLE_LIMIT) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  // ==========================================================
  // LOW-TEXT
  //
  // Native extraction exists, so representative sampling
  // is sufficient as a fallback.
  // ==========================================================

  const candidates = new Set<number>();

  candidates.add(1);
  candidates.add(pageCount);

  const intervals = DEFAULT_SAMPLE_LIMIT - 2;

  for (let index = 1; index <= intervals; index += 1) {
    const ratio = index / (intervals + 1);

    const page = Math.max(
      1,
      Math.min(pageCount, Math.round(pageCount * ratio)),
    );

    candidates.add(page);
  }

  return [...candidates].sort((a, b) => a - b).slice(0, DEFAULT_SAMPLE_LIMIT);
}

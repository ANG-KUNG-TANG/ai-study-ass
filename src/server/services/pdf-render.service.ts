import { PDFParse } from "pdf-parse";
import { CanvasFactory } from "pdf-parse/worker";
import { FileError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

export interface RenderedPdfPage {
  pageNumber: number;
  buffer: Buffer;
}

export async function renderPdfPages(
  pdfBuffer: Buffer,
  pageNumbers: number[],
): Promise<RenderedPdfPage[]> {
  const pages = [...new Set(pageNumbers)]
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((a, b) => a - b);

  if (pages.length === 0) {
    return [];
  }

  const parser = new PDFParse({
    data: pdfBuffer,
    CanvasFactory,
  });

  try {
    const result = await parser.getScreenshot({
      partial: pages,
      desiredWidth: 1280,
      imageDataUrl: false,
      imageBuffer: true,
    });

    return result.pages.map((page, index) => ({
      pageNumber: pages[index],
      buffer: Buffer.from(page.data),
    }));
  } catch (error) {
    logger.error("PDF page rendering failed", {
      pages,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new FileError(
      `Failed to render PDF pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  } finally {
    try {
      await parser.destroy();
    } catch (error) {
      logger.warn("PDF renderer cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

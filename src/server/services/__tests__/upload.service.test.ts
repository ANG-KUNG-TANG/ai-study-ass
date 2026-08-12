// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("@/server/services/pdf.service", () => ({
  parsePDF: jest.fn(),

  parseDOCX: jest.fn(),
}));

jest.mock("@/server/services/pdf-page-selection.service", () => ({
  selectVisionPages: jest.fn(),
}));

jest.mock("@/server/services/pdf-render.service", () => ({
  renderPdfPages: jest.fn(),
}));

jest.mock("@/server/services/pdf-reconstruction.service", () => ({
  reconstructPdfText: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { parsePDF, parseDOCX } from "@/server/services/pdf.service";

import { selectVisionPages } from "@/server/services/pdf-page-selection.service";

import { renderPdfPages } from "@/server/services/pdf-render.service";

import { reconstructPdfText } from "@/server/services/pdf-reconstruction.service";

import { processUpload } from "@/server/services/upload.service";

// ─────────────────────────────────────────────────────────────────────────────
// Typed mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockedParsePDF = parsePDF as jest.MockedFunction<typeof parsePDF>;

const mockedParseDOCX = parseDOCX as jest.MockedFunction<typeof parseDOCX>;

const mockedSelectVisionPages = selectVisionPages as jest.MockedFunction<
  typeof selectVisionPages
>;

const mockedRenderPdfPages = renderPdfPages as jest.MockedFunction<
  typeof renderPdfPages
>;

const mockedReconstructPdfText = reconstructPdfText as jest.MockedFunction<
  typeof reconstructPdfText
>;

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("upload.service - PDF vision pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 1
  //
  // NORMAL PDF
  //
  // Native extraction should be used directly.
  // Vision pipeline must not execute.
  // ═════════════════════════════════════════════════════════════════════════

  it("uses native content directly for normal PDFs", async () => {
    const nativeText = "This is clean native PDF content.";

    mockedParsePDF.mockResolvedValue({
      text: nativeText,

      pageCount: 10,

      charCount: nativeText.length,

      extractionQuality: "normal",

      charsPerPage: 350,

      requiresVisionFallback: false,
    });

    const file = {
      buffer: Buffer.from("%PDF-normal"),

      originalName: "chapter7.pdf",

      mimeType: "application/pdf",

      size: 1024,
    };

    const result = await processUpload(file);

    expect(mockedParsePDF).toHaveBeenCalledTimes(1);

    expect(mockedParsePDF).toHaveBeenCalledWith(file.buffer);

    // Vision pipeline must not execute.

    expect(mockedSelectVisionPages).not.toHaveBeenCalled();

    expect(mockedRenderPdfPages).not.toHaveBeenCalled();

    expect(mockedReconstructPdfText).not.toHaveBeenCalled();

    expect(result.fileType).toBe("pdf");

    expect(result.content).toBe(nativeText);

    expect(result.pageCount).toBe(10);

    expect(result.charCount).toBe(nativeText.length);

    expect(result.extractionQuality).toBe("normal");

    expect(result.requiresVisionFallback).toBe(false);

    expect(result.visionFallbackUsed).toBe(false);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 2
  //
  // LOW-TEXT PDF
  //
  // Representative pages are OCR'd.
  //
  // Final canonical content:
  //
  // native + OCR
  // ═════════════════════════════════════════════════════════════════════════

  it("keeps native and vision content for low-text PDFs", async () => {
    const nativeText = "Chapter 7";

    mockedParsePDF.mockResolvedValue({
      text: nativeText,

      pageCount: 31,

      charCount: nativeText.length,

      extractionQuality: "low-text",

      charsPerPage: 0.29,

      requiresVisionFallback: true,
    });

    const selectedPages = [1, 4, 9, 13, 18, 22, 27, 31];

    mockedSelectVisionPages.mockReturnValue(selectedPages);

    const renderedPages = selectedPages.map((pageNumber) => ({
      pageNumber,

      buffer: Buffer.from(`page-${pageNumber}`),
    }));

    mockedRenderPdfPages.mockResolvedValue(renderedPages);

    const visionText = [
      "--- PAGE 1 ---",
      "Scientific Validation",
      "",
      "--- PAGE 9 ---",
      "Customer Discovery",
      "",
      "--- PAGE 31 ---",
      "Recommendation",
    ].join("\n");

    const reconstructedText = [
      nativeText,
      "",
      "--- VISION RECOVERED CONTENT ---",
      visionText,
    ].join("\n");

    mockedReconstructPdfText.mockResolvedValue({
      text: reconstructedText,

      nativeText,

      visionText,

      visionUsed: true,

      charCount: reconstructedText.length,
    });

    const file = {
      buffer: Buffer.from("%PDF-low-text"),

      originalName: "chapter7-slides.pdf",

      mimeType: "application/pdf",

      size: 2048,
    };

    const result = await processUpload(file);

    // Correct new selector signature.

    expect(mockedSelectVisionPages).toHaveBeenCalledWith(31, "low-text");

    // Correct pages rendered.

    expect(mockedRenderPdfPages).toHaveBeenCalledWith(
      file.buffer,
      selectedPages,
    );

    // Reconstruction receives native + images.

    expect(mockedReconstructPdfText).toHaveBeenCalledWith({
      native: {
        text: nativeText,

        pageCount: 31,
      },

      renderedPages,
    });

    // IMPORTANT:
    //
    // Low-text keeps BOTH native + OCR.

    expect(result.content).toBe(reconstructedText);

    expect(result.content).toContain(nativeText);

    expect(result.content).toContain("Scientific Validation");

    expect(result.content).toContain("Recommendation");

    expect(result.charCount).toBe(reconstructedText.length);

    expect(result.extractionQuality).toBe("low-text");

    expect(result.requiresVisionFallback).toBe(true);

    expect(result.visionFallbackUsed).toBe(true);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 3
  //
  // IMAGE-HEAVY PDF
  //
  // Every page should be selected.
  //
  // Native extraction is assumed to be noise.
  //
  // Final canonical content:
  //
  // OCR ONLY
  // ═════════════════════════════════════════════════════════════════════════

  it("uses OCR-only canonical content for image-heavy PDFs", async () => {
    const nativeNoise = [
      "-- 1 of 31 --",
      "-- 2 of 31 --",
      "-- 3 of 31 --",
      "Case Study",
      "-- 31 of 31 --",
    ].join("\n");

    mockedParsePDF.mockResolvedValue({
      text: nativeNoise,

      pageCount: 31,

      charCount: nativeNoise.length,

      extractionQuality: "image-heavy",

      charsPerPage: 16.03,

      requiresVisionFallback: true,
    });

    const allPages = Array.from(
      {
        length: 31,
      },

      (_, index) => index + 1,
    );

    mockedSelectVisionPages.mockReturnValue(allPages);

    const renderedPages = allPages.map((pageNumber) => ({
      pageNumber,

      buffer: Buffer.from(`page-${pageNumber}`),
    }));

    mockedRenderPdfPages.mockResolvedValue(renderedPages);

    const visionText = [
      "--- PAGE 1 ---",
      "# Scientific Validation of the Business Model",
      "",
      "--- PAGE 2 ---",
      "# Startups do not fail because of bad technology.",
      "",
      "--- PAGE 31 ---",
      "# Recommendation: Persevere with MVP Development",
    ].join("\n");

    const reconstructedText = [
      nativeNoise,
      "",
      "--- VISION RECOVERED CONTENT ---",
      visionText,
    ].join("\n");

    mockedReconstructPdfText.mockResolvedValue({
      text: reconstructedText,

      nativeText: nativeNoise,

      visionText,

      visionUsed: true,

      charCount: reconstructedText.length,
    });

    const file = {
      buffer: Buffer.from("%PDF-image-heavy"),

      originalName: "DTI324-Chapter7.pdf",

      mimeType: "application/pdf",

      size: 4_366_878,
    };

    const result = await processUpload(file);

    // Image-heavy selection receives quality.

    expect(mockedSelectVisionPages).toHaveBeenCalledWith(31, "image-heavy");

    // All pages are rendered.

    expect(mockedRenderPdfPages).toHaveBeenCalledWith(file.buffer, allPages);

    expect(allPages).toHaveLength(31);

    // Reconstruction still receives native
    // extraction because reconstruction owns
    // normalization/recovery.

    expect(mockedReconstructPdfText).toHaveBeenCalledWith({
      native: {
        text: nativeNoise,

        pageCount: 31,
      },

      renderedPages,
    });

    // ───────────────────────────────────────────────────────
    // CRITICAL ASSERTION
    //
    // Image-heavy PDF canonical content must be OCR only.
    // ───────────────────────────────────────────────────────

    expect(result.content).toBe(visionText);

    // Native page-marker noise must NOT reach intelligence.

    expect(result.content).not.toContain("-- 1 of 31 --");

    expect(result.content).not.toContain("VISION RECOVERED CONTENT");

    expect(result.content).toContain("Scientific Validation");

    expect(result.content).toContain("Persevere with MVP Development");

    // charCount now represents canonical content.

    expect(result.charCount).toBe(visionText.length);

    expect(result.extractionQuality).toBe("image-heavy");

    expect(result.requiresVisionFallback).toBe(true);

    expect(result.visionFallbackUsed).toBe(true);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 4
  //
  // OCR/reconstruction errors must propagate.
  //
  // Do NOT silently fall back to poor native text.
  // ═════════════════════════════════════════════════════════════════════════

  it("propagates reconstruction failure when vision is required", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "Very little text",

      pageCount: 20,

      charCount: 16,

      extractionQuality: "image-heavy",

      charsPerPage: 0.8,

      requiresVisionFallback: true,
    });

    const selectedPages = Array.from(
      {
        length: 20,
      },

      (_, index) => index + 1,
    );

    mockedSelectVisionPages.mockReturnValue(selectedPages);

    const renderedPages = selectedPages.map((pageNumber) => ({
      pageNumber,

      buffer: Buffer.from(`page-${pageNumber}`),
    }));

    mockedRenderPdfPages.mockResolvedValue(renderedPages);

    mockedReconstructPdfText.mockRejectedValue(
      new Error("Vision provider unavailable"),
    );

    const file = {
      buffer: Buffer.from("%PDF-poor"),

      originalName: "scanned.pdf",

      mimeType: "application/pdf",

      size: 1000,
    };

    await expect(processUpload(file)).rejects.toThrow(
      "Vision provider unavailable",
    );

    expect(mockedSelectVisionPages).toHaveBeenCalledWith(20, "image-heavy");

    expect(mockedReconstructPdfText).toHaveBeenCalledTimes(1);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 5
  //
  // Fallback required but page selector returns nothing.
  // ═════════════════════════════════════════════════════════════════════════

  it("throws when vision fallback is required but no pages can be selected", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "",

      pageCount: 0,

      charCount: 0,

      extractionQuality: "image-heavy",

      charsPerPage: 0,

      requiresVisionFallback: true,
    });

    mockedSelectVisionPages.mockReturnValue([]);

    const file = {
      buffer: Buffer.from("%PDF-empty"),

      originalName: "broken.pdf",

      mimeType: "application/pdf",

      size: 500,
    };

    await expect(processUpload(file)).rejects.toThrow(
      "PDF requires vision fallback but no pages could be selected.",
    );

    expect(mockedSelectVisionPages).toHaveBeenCalledWith(0, "image-heavy");

    expect(mockedRenderPdfPages).not.toHaveBeenCalled();

    expect(mockedReconstructPdfText).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 6
  //
  // Renderer fails to return pages.
  // ═════════════════════════════════════════════════════════════════════════

  it("throws when selected PDF pages cannot be rendered", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "Limited text",

      pageCount: 10,

      charCount: 12,

      extractionQuality: "low-text",

      charsPerPage: 1.2,

      requiresVisionFallback: true,
    });

    mockedSelectVisionPages.mockReturnValue([1, 3, 5, 7, 10]);

    mockedRenderPdfPages.mockResolvedValue([]);

    const file = {
      buffer: Buffer.from("%PDF-render-fail"),

      originalName: "render-fail.pdf",

      mimeType: "application/pdf",

      size: 1000,
    };

    await expect(processUpload(file)).rejects.toThrow(
      "PDF pages could not be rendered for vision processing.",
    );

    expect(mockedSelectVisionPages).toHaveBeenCalledWith(10, "low-text");

    expect(mockedReconstructPdfText).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 7
  //
  // DOCX must remain completely independent from PDF vision processing.
  // ═════════════════════════════════════════════════════════════════════════

  it("processes DOCX without entering the PDF vision pipeline", async () => {
    const docxText = "DOCX document content";

    mockedParseDOCX.mockResolvedValue({
      text: docxText,

      charCount: docxText.length,
    });

    const file = {
      buffer: Buffer.from("fake-docx"),

      originalName: "requirements.docx",

      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      size: 1000,
    };

    const result = await processUpload(file);

    expect(mockedParseDOCX).toHaveBeenCalledWith(file.buffer);

    expect(mockedParsePDF).not.toHaveBeenCalled();

    expect(mockedSelectVisionPages).not.toHaveBeenCalled();

    expect(mockedRenderPdfPages).not.toHaveBeenCalled();

    expect(mockedReconstructPdfText).not.toHaveBeenCalled();

    expect(result.fileType).toBe("docx");

    expect(result.content).toBe(docxText);

    expect(result.charCount).toBe(docxText.length);

    expect(result.requiresVisionFallback).toBe(false);

    expect(result.visionFallbackUsed).toBe(false);
  });
});

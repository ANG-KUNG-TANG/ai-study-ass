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

import { parsePDF, parseDOCX } from "@/server/services/pdf.service";

import { selectVisionPages } from "@/server/services/pdf-page-selection.service";

import { renderPdfPages } from "@/server/services/pdf-render.service";

import { reconstructPdfText } from "@/server/services/pdf-reconstruction.service";

import { processUpload } from "@/server/services/upload.service";

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

describe("upload.service - PDF vision pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================
  // TEST 1
  // Normal PDF:
  // Native extraction is sufficient.
  // Vision must NOT run.
  // ==========================================================

  it("returns native PDF text without vision when extraction quality is normal", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "This is clean native PDF content.",

      pageCount: 10,

      charCount: 33,

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

    // Vision path must not run.
    expect(mockedSelectVisionPages).not.toHaveBeenCalled();

    expect(mockedRenderPdfPages).not.toHaveBeenCalled();

    expect(mockedReconstructPdfText).not.toHaveBeenCalled();

    expect(result.fileType).toBe("pdf");

    expect(result.content).toBe("This is clean native PDF content.");

    expect(result.pageCount).toBe(10);

    expect(result.charCount).toBe(33);

    expect(result.extractionQuality).toBe("normal");

    expect(result.requiresVisionFallback).toBe(false);

    expect(result.visionFallbackUsed).toBe(false);
  });

  // ==========================================================
  // TEST 2
  // Low-text PDF:
  // Uses representative page sampling.
  // ==========================================================

  it("uses vision reconstruction when native PDF extraction is low-text", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "Chapter 7",

      pageCount: 31,

      charCount: 9,

      extractionQuality: "low-text",

      charsPerPage: 0.29,

      requiresVisionFallback: true,
    });

    const selectedPages = [1, 4, 9, 13, 18, 22, 27, 31];

    mockedSelectVisionPages.mockReturnValue(selectedPages);

    const renderedPages = [
      {
        pageNumber: 1,
        buffer: Buffer.from("page-one"),
      },

      {
        pageNumber: 4,
        buffer: Buffer.from("page-four"),
      },

      {
        pageNumber: 9,
        buffer: Buffer.from("page-nine"),
      },

      {
        pageNumber: 13,
        buffer: Buffer.from("page-thirteen"),
      },

      {
        pageNumber: 18,
        buffer: Buffer.from("page-eighteen"),
      },

      {
        pageNumber: 22,
        buffer: Buffer.from("page-twenty-two"),
      },

      {
        pageNumber: 27,
        buffer: Buffer.from("page-twenty-seven"),
      },

      {
        pageNumber: 31,
        buffer: Buffer.from("page-thirty-one"),
      },
    ];

    mockedRenderPdfPages.mockResolvedValue(renderedPages);

    const reconstructedText = [
      "Chapter 7",
      "",
      "--- VISION RECOVERED CONTENT ---",
      "",
      "--- PAGE 1 ---",
      "System Requirements",
      "",
      "--- PAGE 4 ---",
      "Validated Learning",
      "",
      "--- PAGE 9 ---",
      "Customer Discovery",
      "",
      "--- PAGE 31 ---",
      "Recommendation",
    ].join("\n");

    mockedReconstructPdfText.mockResolvedValue({
      text: reconstructedText,

      nativeText: "Chapter 7",

      visionText: [
        "--- PAGE 1 ---",
        "System Requirements",
        "",
        "--- PAGE 4 ---",
        "Validated Learning",
        "",
        "--- PAGE 9 ---",
        "Customer Discovery",
        "",
        "--- PAGE 31 ---",
        "Recommendation",
      ].join("\n"),

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

    // Native extraction first.
    expect(mockedParsePDF).toHaveBeenCalledWith(file.buffer);

    // IMPORTANT:
    // New function signature includes extraction quality.
    expect(mockedSelectVisionPages).toHaveBeenCalledWith(31, "low-text");

    expect(mockedRenderPdfPages).toHaveBeenCalledWith(
      file.buffer,
      selectedPages,
    );

    expect(mockedReconstructPdfText).toHaveBeenCalledWith({
      native: {
        text: "Chapter 7",

        pageCount: 31,
      },

      renderedPages,
    });

    expect(result.fileType).toBe("pdf");

    expect(result.content).toContain("System Requirements");

    expect(result.content).toContain("Customer Discovery");

    expect(result.content).toContain("Recommendation");

    expect(result.pageCount).toBe(31);

    expect(result.extractionQuality).toBe("low-text");

    expect(result.requiresVisionFallback).toBe(true);

    expect(result.visionFallbackUsed).toBe(true);

    expect(result.charCount).toBe(reconstructedText.length);
  });

  // ==========================================================
  // TEST 3
  // Image-heavy PDF:
  // Every page should be selected.
  // ==========================================================

  it("uses every page for image-heavy PDFs", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "Case Study",

      pageCount: 31,

      charCount: 497,

      extractionQuality: "image-heavy",

      charsPerPage: 16.03,

      requiresVisionFallback: true,
    });

    const allPages = Array.from(
      { length: 31 },

      (_, index) => index + 1,
    );

    mockedSelectVisionPages.mockReturnValue(allPages);

    const renderedPages = allPages.map((pageNumber) => ({
      pageNumber,

      buffer: Buffer.from(`page-${pageNumber}`),
    }));

    mockedRenderPdfPages.mockResolvedValue(renderedPages);

    mockedReconstructPdfText.mockResolvedValue({
      text: "Recovered complete Chapter 7 document",

      nativeText: "Case Study",

      visionText: "Recovered complete Chapter 7 document",

      visionUsed: true,

      charCount: 37,
    });

    const file = {
      buffer: Buffer.from("%PDF-image-heavy"),

      originalName: "image-heavy.pdf",

      mimeType: "application/pdf",

      size: 4096,
    };

    const result = await processUpload(file);

    expect(mockedSelectVisionPages).toHaveBeenCalledWith(31, "image-heavy");

    expect(mockedRenderPdfPages).toHaveBeenCalledWith(file.buffer, allPages);

    expect(mockedReconstructPdfText).toHaveBeenCalledWith({
      native: {
        text: "Case Study",

        pageCount: 31,
      },

      renderedPages,
    });

    expect(result.extractionQuality).toBe("image-heavy");

    expect(result.requiresVisionFallback).toBe(true);

    expect(result.visionFallbackUsed).toBe(true);

    expect(result.content).toBe("Recovered complete Chapter 7 document");
  });

  // ==========================================================
  // TEST 4
  // OCR / reconstruction failure:
  // Must propagate.
  // ==========================================================

  it("propagates reconstruction failure for a PDF that requires vision", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "Very little text",

      pageCount: 20,

      charCount: 16,

      extractionQuality: "image-heavy",

      charsPerPage: 0.8,

      requiresVisionFallback: true,
    });

    const selectedPages = Array.from(
      { length: 20 },

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

    expect(mockedRenderPdfPages).toHaveBeenCalledWith(
      file.buffer,
      selectedPages,
    );

    expect(mockedReconstructPdfText).toHaveBeenCalledTimes(1);
  });

  // ==========================================================
  // TEST 5
  // No selected pages:
  // Upload service should reject inconsistent fallback state.
  // ==========================================================

  it("throws when vision fallback is required but no pages are selected", async () => {
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
      buffer: Buffer.from("%PDF-empty-pages"),

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

  // ==========================================================
  // TEST 6
  // Renderer returns nothing.
  // ==========================================================

  it("throws when selected PDF pages cannot be rendered", async () => {
    mockedParsePDF.mockResolvedValue({
      text: "Very little content",

      pageCount: 10,

      charCount: 19,

      extractionQuality: "low-text",

      charsPerPage: 1.9,

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

  // ==========================================================
  // TEST 7
  // DOCX is unaffected by PDF vision changes.
  // ==========================================================

  it("processes DOCX without entering the PDF vision pipeline", async () => {
    mockedParseDOCX.mockResolvedValue({
      text: "DOCX document content",

      charCount: 21,
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

    expect(result.content).toBe("DOCX document content");
  });
});

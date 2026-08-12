jest.mock("@/server/services/pdf-ocr.service", () => ({
  extractTextFromRenderedPages: jest.fn(),
}));

import { extractTextFromRenderedPages } from "@/server/services/pdf-ocr.service";
import { reconstructPdfText } from "@/server/services/pdf-reconstruction.service";

const mockedExtractTextFromRenderedPages =
  extractTextFromRenderedPages as jest.MockedFunction<
    typeof extractTextFromRenderedPages
  >;

describe("pdf-reconstruction.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================
  // TEST 1
  // Native PDF only
  // ==========================================================

  it("returns native text without vision when no rendered pages are provided", async () => {
    const result = await reconstructPdfText({
      native: {
        text: "Native PDF content",
        pageCount: 5,
      },

      renderedPages: [],
    });

    expect(result).toEqual({
      text: "Native PDF content",

      nativeText: "Native PDF content",

      visionText: null,

      visionUsed: false,

      charCount: "Native PDF content".length,
    });

    expect(mockedExtractTextFromRenderedPages).not.toHaveBeenCalled();
  });

  // ==========================================================
  // TEST 2
  // Native + OCR
  // ==========================================================

  it("merges native text with OCR text when rendered pages exist", async () => {
    mockedExtractTextFromRenderedPages.mockResolvedValue({
      text: [
        "--- PAGE 1 ---",
        "Chapter 7 System Requirements",
        "",
        "--- PAGE 5 ---",
        "Functional Requirements",
      ].join("\n"),

      pages: [
        {
          pageNumber: 1,
          text: "Chapter 7 System Requirements",
        },

        {
          pageNumber: 5,
          text: "Functional Requirements",
        },
      ],

      provider: "gemini",

      model: "test-model",

      processedPages: 2,

      charCount: 90,
    });

    const renderedPages = [
      {
        pageNumber: 1,

        buffer: Buffer.from("page-one"),

        mimeType: "image/png" as const,
      },

      {
        pageNumber: 5,

        buffer: Buffer.from("page-five"),

        mimeType: "image/png" as const,
      },
    ];

    const result = await reconstructPdfText({
      native: {
        text: "Existing native PDF text",

        pageCount: 10,
      },

      renderedPages,
    });

    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledTimes(1);

    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledWith(
      renderedPages,
    );

    expect(result.visionUsed).toBe(true);

    expect(result.nativeText).toBe("Existing native PDF text");

    expect(result.visionText).toContain("Chapter 7 System Requirements");

    expect(result.text).toContain("Existing native PDF text");

    expect(result.text).toContain("--- VISION RECOVERED CONTENT ---");

    expect(result.text).toContain("Functional Requirements");

    expect(result.charCount).toBe(result.text.length);
  });

  // ==========================================================
  // TEST 3
  // Whitespace
  // ==========================================================

  it("normalizes excessive whitespace", async () => {
    mockedExtractTextFromRenderedPages.mockResolvedValue({
      text: `
--- PAGE 1 ---


Software     Requirements


Functional      Requirements
            `.trim(),

      pages: [
        {
          pageNumber: 1,

          text: "Software Requirements\nFunctional Requirements",
        },
      ],

      provider: "openai",

      model: "test-model",

      processedPages: 1,

      charCount: 50,
    });

    const result = await reconstructPdfText({
      native: {
        text: `
                Native     document


                content
              `,

        pageCount: 1,
      },

      renderedPages: [
        {
          pageNumber: 1,

          buffer: Buffer.from("image"),
        },
      ],
    });

    expect(result.nativeText).toBe("Native document\n\ncontent");

    expect(result.text).not.toContain("Native     document");

    expect(result.text).not.toMatch(/\n{3,}/);
  });

  // ==========================================================
  // TEST 4
  // Non-timeout OCR errors
  // ==========================================================

  it("propagates OCR failure instead of silently returning incomplete content", async () => {
    mockedExtractTextFromRenderedPages.mockRejectedValue(
      new Error("Vision provider unavailable"),
    );

    await expect(
      reconstructPdfText({
        native: {
          text: "Very limited native text",

          pageCount: 10,
        },

        renderedPages: [
          {
            pageNumber: 1,

            buffer: Buffer.from("page"),
          },
        ],
      }),
    ).rejects.toThrow("Vision provider unavailable");

    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledTimes(1);
  });

  // ==========================================================
  // TEST 5
  // Completely scanned/image-based PDF
  // ==========================================================

  it("handles empty native text when OCR recovers content", async () => {
    mockedExtractTextFromRenderedPages.mockResolvedValue({
      text: "--- PAGE 1 ---\nRecovered slide content",

      pages: [
        {
          pageNumber: 1,

          text: "Recovered slide content",
        },
      ],

      provider: "gemini",

      model: "test-model",

      processedPages: 1,

      charCount: 23,
    });

    const result = await reconstructPdfText({
      native: {
        text: "",

        pageCount: 1,
      },

      renderedPages: [
        {
          pageNumber: 1,

          buffer: Buffer.from("page"),
        },
      ],
    });

    expect(result.visionUsed).toBe(true);

    expect(result.nativeText).toBe("");

    expect(result.visionText).toContain("Recovered slide content");

    expect(result.text).toContain("Recovered slide content");
  });

  // ==========================================================
  // TEST 6
  // Standard batching: 8 pages → 5 + 3
  // ==========================================================

  it("batches more than five rendered pages for OCR", async () => {
    mockedExtractTextFromRenderedPages
      .mockResolvedValueOnce({
        text: `
--- PAGE 1 ---
Page one

--- PAGE 2 ---
Page two

--- PAGE 3 ---
Page three

--- PAGE 4 ---
Page four

--- PAGE 5 ---
Page five
            `.trim(),

        pages: [
          {
            pageNumber: 1,
            text: "Page one",
          },

          {
            pageNumber: 2,
            text: "Page two",
          },

          {
            pageNumber: 3,
            text: "Page three",
          },

          {
            pageNumber: 4,
            text: "Page four",
          },

          {
            pageNumber: 5,
            text: "Page five",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 5,

        charCount: 100,
      })

      .mockResolvedValueOnce({
        text: `
--- PAGE 6 ---
Page six

--- PAGE 7 ---
Page seven

--- PAGE 8 ---
Page eight
            `.trim(),

        pages: [
          {
            pageNumber: 6,
            text: "Page six",
          },

          {
            pageNumber: 7,
            text: "Page seven",
          },

          {
            pageNumber: 8,
            text: "Page eight",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 3,

        charCount: 60,
      });

    const renderedPages = Array.from(
      { length: 8 },

      (_, index) => ({
        pageNumber: index + 1,

        buffer: Buffer.from(`page-${index + 1}`),
      }),
    );

    const result = await reconstructPdfText({
      native: {
        text: "Native text",

        pageCount: 8,
      },

      renderedPages,
    });

    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledTimes(2);

    // Batch 1 = 5 pages

    expect(mockedExtractTextFromRenderedPages.mock.calls[0][0]).toHaveLength(5);

    expect(
      mockedExtractTextFromRenderedPages.mock.calls[0][0].map(
        (page) => page.pageNumber,
      ),
    ).toEqual([1, 2, 3, 4, 5]);

    // Batch 2 = 3 pages

    expect(mockedExtractTextFromRenderedPages.mock.calls[1][0]).toHaveLength(3);

    expect(
      mockedExtractTextFromRenderedPages.mock.calls[1][0].map(
        (page) => page.pageNumber,
      ),
    ).toEqual([6, 7, 8]);

    expect(result.visionUsed).toBe(true);

    expect(result.text).toContain("Page one");

    expect(result.text).toContain("Page eight");

    expect(result.charCount).toBe(result.text.length);
  });

  // ==========================================================
  // TEST 7
  // Timeout → recursively split batch
  // ==========================================================

  it("splits an OCR batch when vision times out", async () => {
    mockedExtractTextFromRenderedPages
      // Original 5-page request
      .mockRejectedValueOnce(
        new Error("Gemini vision request timed out after 30000ms"),
      )

      // Retry pages 1–3
      .mockResolvedValueOnce({
        text: `
--- PAGE 1 ---
Page one

--- PAGE 2 ---
Page two

--- PAGE 3 ---
Page three
            `.trim(),

        pages: [
          {
            pageNumber: 1,
            text: "Page one",
          },

          {
            pageNumber: 2,
            text: "Page two",
          },

          {
            pageNumber: 3,
            text: "Page three",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 3,

        charCount: 60,
      })

      // Retry pages 4–5
      .mockResolvedValueOnce({
        text: `
--- PAGE 4 ---
Page four

--- PAGE 5 ---
Page five
            `.trim(),

        pages: [
          {
            pageNumber: 4,
            text: "Page four",
          },

          {
            pageNumber: 5,
            text: "Page five",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 2,

        charCount: 40,
      });

    const renderedPages = Array.from(
      { length: 5 },

      (_, index) => ({
        pageNumber: index + 1,

        buffer: Buffer.from(`page-${index + 1}`),
      }),
    );

    const result = await reconstructPdfText({
      native: {
        text: "Native text",

        pageCount: 5,
      },

      renderedPages,
    });

    // 1 original +
    // 2 retry batches
    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledTimes(3);

    // Original attempt:
    // 5 pages
    expect(mockedExtractTextFromRenderedPages.mock.calls[0][0]).toHaveLength(5);

    expect(
      mockedExtractTextFromRenderedPages.mock.calls[0][0].map(
        (page) => page.pageNumber,
      ),
    ).toEqual([1, 2, 3, 4, 5]);

    // First retry:
    // 3 pages
    expect(mockedExtractTextFromRenderedPages.mock.calls[1][0]).toHaveLength(3);

    expect(
      mockedExtractTextFromRenderedPages.mock.calls[1][0].map(
        (page) => page.pageNumber,
      ),
    ).toEqual([1, 2, 3]);

    // Second retry:
    // 2 pages
    expect(mockedExtractTextFromRenderedPages.mock.calls[2][0]).toHaveLength(2);

    expect(
      mockedExtractTextFromRenderedPages.mock.calls[2][0].map(
        (page) => page.pageNumber,
      ),
    ).toEqual([4, 5]);

    expect(result.visionUsed).toBe(true);

    expect(result.text).toContain("Page one");

    expect(result.text).toContain("Page three");

    expect(result.text).toContain("Page five");

    expect(result.charCount).toBe(result.text.length);
  });

  // ==========================================================
  // TEST 8
  // Single-page timeout must still fail
  // ==========================================================

  it("propagates timeout when a single OCR page still times out", async () => {
    mockedExtractTextFromRenderedPages.mockRejectedValue(
      new Error("Gemini vision request timed out after 30000ms"),
    );

    await expect(
      reconstructPdfText({
        native: {
          text: "",

          pageCount: 1,
        },

        renderedPages: [
          {
            pageNumber: 1,

            buffer: Buffer.from("page-one"),
          },
        ],
      }),
    ).rejects.toThrow("Gemini vision request timed out after 30000ms");

    // Single page cannot
    // be divided further.
    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledTimes(1);
  });

  // ==========================================================
  // TEST 9
  // Recursive timeout splitting
  // ==========================================================

  it("can recursively split a slow OCR batch more than once", async () => {
    mockedExtractTextFromRenderedPages
      // 5 pages fail
      .mockRejectedValueOnce(new Error("Vision timeout"))

      // 3 pages also fail
      .mockRejectedValueOnce(new Error("Vision timeout"))

      // 2 pages succeed
      .mockResolvedValueOnce({
        text: `
--- PAGE 1 ---
Page one

--- PAGE 2 ---
Page two
            `.trim(),

        pages: [
          {
            pageNumber: 1,
            text: "Page one",
          },

          {
            pageNumber: 2,
            text: "Page two",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 2,

        charCount: 40,
      })

      // page 3 succeeds
      .mockResolvedValueOnce({
        text: `
--- PAGE 3 ---
Page three
            `.trim(),

        pages: [
          {
            pageNumber: 3,
            text: "Page three",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 1,

        charCount: 20,
      })

      // Original right side:
      // pages 4–5
      .mockResolvedValueOnce({
        text: `
--- PAGE 4 ---
Page four

--- PAGE 5 ---
Page five
            `.trim(),

        pages: [
          {
            pageNumber: 4,
            text: "Page four",
          },

          {
            pageNumber: 5,
            text: "Page five",
          },
        ],

        provider: "gemini",

        model: "test-model",

        processedPages: 2,

        charCount: 40,
      });

    const renderedPages = Array.from(
      { length: 5 },

      (_, index) => ({
        pageNumber: index + 1,

        buffer: Buffer.from(`page-${index + 1}`),
      }),
    );

    const result = await reconstructPdfText({
      native: {
        text: "",

        pageCount: 5,
      },

      renderedPages,
    });

    expect(mockedExtractTextFromRenderedPages).toHaveBeenCalledTimes(5);

    expect(result.text).toContain("Page one");

    expect(result.text).toContain("Page three");

    expect(result.text).toContain("Page five");

    expect(result.visionUsed).toBe(true);
  });
});

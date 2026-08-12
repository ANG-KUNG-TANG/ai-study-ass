jest.mock("@/server/services/vision.service", () => ({
  generateFromImages: jest.fn(),
}));

import { generateFromImages } from "@/server/services/vision.service";

import { extractTextFromRenderedPages } from "@/server/services/pdf-ocr.service";

const mockedGenerate = generateFromImages as jest.MockedFunction<
  typeof generateFromImages
>;

describe("pdf-ocr.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("extracts page-separated text", async () => {
    mockedGenerate.mockResolvedValue({
      provider: "gemini",
      model: "test-model",

      text: `
--- PAGE 1 ---
Software requirements describe what the system must do.

--- PAGE 5 ---
Functional requirements define system services.

--- PAGE 10 ---
Non-functional requirements define quality constraints.
      `.trim(),
    });

    const result = await extractTextFromRenderedPages([
      {
        pageNumber: 1,
        buffer: Buffer.from("page-one"),
      },
      {
        pageNumber: 5,
        buffer: Buffer.from("page-five"),
      },
      {
        pageNumber: 10,
        buffer: Buffer.from("page-ten"),
      },
    ]);

    expect(result.processedPages).toBe(3);

    expect(result.pages).toEqual([
      {
        pageNumber: 1,
        text: "Software requirements describe what the system must do.",
      },
      {
        pageNumber: 5,
        text: "Functional requirements define system services.",
      },
      {
        pageNumber: 10,
        text: "Non-functional requirements define quality constraints.",
      },
    ]);

    expect(result.text).toContain("--- PAGE 5 ---");

    expect(mockedGenerate).toHaveBeenCalledTimes(1);
  });

  it("rejects empty page input", async () => {
    await expect(extractTextFromRenderedPages([])).rejects.toThrow(
      "No rendered PDF pages were supplied for OCR",
    );
  });

  it("rejects empty page buffers", async () => {
    await expect(
      extractTextFromRenderedPages([
        {
          pageNumber: 1,
          buffer: Buffer.alloc(0),
        },
      ]),
    ).rejects.toThrow("Rendered PDF page 1 is empty");
  });

  it("supports unstructured response for one page", async () => {
    mockedGenerate.mockResolvedValue({
      provider: "openai",
      model: "test-model",
      text: "Chapter 7\nSystem Requirements",
    });

    const result = await extractTextFromRenderedPages([
      {
        pageNumber: 1,
        buffer: Buffer.from("page"),
      },
    ]);

    expect(result.pages).toEqual([
      {
        pageNumber: 1,
        text: "Chapter 7\nSystem Requirements",
      },
    ]);
  });
});

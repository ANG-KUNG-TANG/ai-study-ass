import { analysePdfExtraction } from "@/server/services/pdf.service";

describe("analysePdfExtraction", () => {
  it("detects the Chapter 7 style image-heavy PDF", () => {
    const result = analysePdfExtraction(31, 497);

    expect(result.quality).toBe("image-heavy");
    expect(result.requiresVisionFallback).toBe(true);
    expect(result.charsPerPage).toBeCloseTo(16.03, 1);
  });

  it("detects low-text PDFs", () => {
    const result = analysePdfExtraction(10, 800);

    expect(result.quality).toBe("low-text");
    expect(result.requiresVisionFallback).toBe(true);
  });

  it("keeps normal text PDFs on the standard path", () => {
    const result = analysePdfExtraction(10, 15_000);

    expect(result.quality).toBe("normal");
    expect(result.requiresVisionFallback).toBe(false);
  });

  it("handles a zero page count safely", () => {
    const result = analysePdfExtraction(0, 500);

    expect(Number.isFinite(result.charsPerPage)).toBe(true);
  });
});
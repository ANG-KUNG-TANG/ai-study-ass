import { analysePdfExtraction } from "@/server/services/pdf.service";

describe("pdf.service - analysePdfExtraction", () => {
  describe("image-heavy PDFs", () => {
    it("classifies a 2-page scanned PDF with very little native text as image-heavy", () => {
      const result = analysePdfExtraction(2, 26);

      expect(result.quality).toBe("image-heavy");

      expect(result.requiresVisionFallback).toBe(true);

      expect(result.charsPerPage).toBe(13);
    });

    it("classifies a 1-page PDF with no native text as image-heavy", () => {
      const result = analysePdfExtraction(1, 0);

      expect(result.quality).toBe("image-heavy");

      expect(result.requiresVisionFallback).toBe(true);

      expect(result.charsPerPage).toBe(0);
    });

    it("classifies a multi-page scanned PDF with almost no text as image-heavy", () => {
      const result = analysePdfExtraction(10, 100);

      expect(result.quality).toBe("image-heavy");

      expect(result.requiresVisionFallback).toBe(true);

      expect(result.charsPerPage).toBe(10);
    });
  });

  describe("low-text PDFs", () => {
    it("classifies a short PDF with limited native text as low-text", () => {
      const result = analysePdfExtraction(2, 150);

      expect(result.quality).toBe("low-text");

      expect(result.requiresVisionFallback).toBe(true);

      expect(result.charsPerPage).toBe(75);
    });

    it("classifies content just below the normal threshold as low-text", () => {
      const result = analysePdfExtraction(1, 119);

      expect(result.quality).toBe("low-text");

      expect(result.requiresVisionFallback).toBe(true);
    });
  });

  describe("normal PDFs", () => {
    it("classifies a text-rich two-page PDF as normal", () => {
      const result = analysePdfExtraction(2, 1000);

      expect(result.quality).toBe("normal");

      expect(result.requiresVisionFallback).toBe(false);

      expect(result.charsPerPage).toBe(500);
    });

    it("classifies content exactly at the normal threshold as normal", () => {
      const result = analysePdfExtraction(1, 120);

      expect(result.quality).toBe("normal");

      expect(result.requiresVisionFallback).toBe(false);
    });

    it("keeps a large text-rich PDF as normal", () => {
      const result = analysePdfExtraction(12, 12038);

      expect(result.quality).toBe("normal");

      expect(result.requiresVisionFallback).toBe(false);

      expect(result.charsPerPage).toBeCloseTo(1003.1667, 3);
    });
  });

  describe("defensive input handling", () => {
    it("handles page count zero safely", () => {
      const result = analysePdfExtraction(0, 0);

      expect(result.quality).toBe("image-heavy");

      expect(result.requiresVisionFallback).toBe(true);

      expect(result.charsPerPage).toBe(0);
    });

    it("does not allow negative character counts to affect classification", () => {
      const result = analysePdfExtraction(2, -100);

      expect(result.quality).toBe("image-heavy");

      expect(result.requiresVisionFallback).toBe(true);

      expect(result.charsPerPage).toBe(0);
    });
  });
});

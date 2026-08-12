import { selectVisionPages } from "@/server/services/pdf-page-selection.service";

describe("pdf-page-selection.service", () => {
  it("returns every page for small low-text documents", () => {
    expect(selectVisionPages(3, "low-text")).toEqual([1, 2, 3]);
  });

  it("limits large low-text documents to representative pages", () => {
    const pages = selectVisionPages(31, "low-text");

    expect(pages.length).toBeLessThanOrEqual(8);

    expect(pages[0]).toBe(1);

    expect(pages.at(-1)).toBe(31);
  });

  it("returns unique pages for low-text documents", () => {
    const pages = selectVisionPages(31, "low-text");

    expect(new Set(pages).size).toBe(pages.length);
  });

  it("selects every page for an image-heavy PDF", () => {
    const pages = selectVisionPages(31, "image-heavy");

    expect(pages).toHaveLength(31);

    expect(pages).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
  });

  it("samples low-text PDFs instead of processing every page", () => {
    const pages = selectVisionPages(31, "low-text");

    expect(pages.length).toBeLessThanOrEqual(8);

    expect(pages[0]).toBe(1);

    expect(pages.at(-1)).toBe(31);

    expect(pages).not.toHaveLength(31);
  });

  it("returns an empty array for zero pages", () => {
    expect(selectVisionPages(0, "image-heavy")).toEqual([]);
  });

  it("returns an empty array for negative page counts", () => {
    expect(selectVisionPages(-5, "low-text")).toEqual([]);
  });

  it("uses low-text behavior by default", () => {
    const pages = selectVisionPages(31);

    expect(pages.length).toBeLessThanOrEqual(8);

    expect(pages[0]).toBe(1);

    expect(pages.at(-1)).toBe(31);
  });
});

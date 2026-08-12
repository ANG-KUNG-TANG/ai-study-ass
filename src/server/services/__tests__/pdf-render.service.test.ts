import { renderPdfPages } from "@/server/services/pdf-render.service";

describe("renderPdfPages", () => {
  it("returns an empty result when no valid page numbers are given", async () => {
    const result = await renderPdfPages(
      Buffer.from("unused"),
      [0, -1],
    );

    expect(result).toEqual([]);
  });
});
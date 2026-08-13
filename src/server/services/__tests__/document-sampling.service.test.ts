import { sampleDocumentContent } from "@/server/services/document-sampling.service";

describe("document-sampling.service", () => {
  it("returns short documents unchanged", () => {
    const result = sampleDocumentContent("short document", 2_000);
    expect(result.text).toBe("short document");
    expect(result.truncated).toBe(false);
  });

  it("samples representative windows across a long document", () => {
    const chars = Array.from({ length: 25_000 }, () => "x");
    const put = (position: number, marker: string) => {
      marker.split("").forEach((char, offset) => {
        chars[position + offset] = char;
      });
    };

    put(0, "BEGIN_MARKER");
    put(12_500, "MIDDLE_MARKER");
    put(24_980, "END_MARKER");

    const result = sampleDocumentContent(chars.join(""), 10_000);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("BEGIN_MARKER");
    expect(result.text).toContain("MIDDLE_MARKER");
    expect(result.text).toContain("END_MARKER");
    expect(result.text.length).toBeLessThanOrEqual(10_000);
  });
});

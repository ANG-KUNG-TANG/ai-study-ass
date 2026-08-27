import type { DocumentChunk } from "../pipeline";
import {
  buildIntelligenceRepairEvidence,
} from "../fallback/intelligence-repair-evidence";

function chunk(
  input: Partial<DocumentChunk> &
    Pick<DocumentChunk, "id" | "sectionId" | "sectionTitle" | "text">,
): DocumentChunk {
  return {
    semanticRole: "other",
    tokenEstimate: Math.ceil(input.text.length / 4),
    overlapSentenceCount: 0,
    ...input,
  };
}

describe("targeted intelligence repair evidence", () => {
  it("selects the strongest source region for a missing objective", () => {
    const objectiveSentence =
      "The objective is to reduce order errors during peak service.";

    const result = buildIntelligenceRepairEvidence(
      [
        chunk({
          id: "intro",
          sectionId: "s1",
          sectionTitle: "General Notes",
          text:
            "This section contains unrelated operational background. ".repeat(
              120,
            ),
        }),
        chunk({
          id: "objective",
          sectionId: "s2",
          sectionTitle: "Business Objective",
          semanticRole: "background",
          text: [
            "Manual order recording causes errors during peak service.",
            objectiveSentence,
            "The team will compare the revised workflow with current practice.",
          ].join(" "),
        }),
      ],
      ["objective"],
      { maxCharacters: 2_400, maxChunks: 1 },
    );

    expect(result.chunkIds).toEqual(["objective"]);
    expect(result.text).toContain(objectiveSentence);
    expect(result.characterCount).toBeLessThanOrEqual(2_400);
  });

  it("keeps evidence for different missing field types within one small window", () => {
    const methodSentence =
      "The evaluation uses stratified cross-validation for model assessment.";
    const resultSentence =
      "The measured F1 score increased to 0.84 on the held-out folds.";

    const result = buildIntelligenceRepairEvidence(
      [
        chunk({
          id: "method",
          sectionId: "s-method",
          sectionTitle: "Methodology",
          semanticRole: "method",
          text: methodSentence,
        }),
        chunk({
          id: "results",
          sectionId: "s-results",
          sectionTitle: "Results",
          semanticRole: "results",
          text: resultSentence,
        }),
        chunk({
          id: "background",
          sectionId: "s-background",
          sectionTitle: "Background",
          semanticRole: "background",
          text: "Historical context is discussed without evaluation details.",
        }),
      ],
      ["method", "result"],
      { maxCharacters: 3_000, maxChunks: 2 },
    );

    expect(result.chunkIds).toEqual(
      expect.arrayContaining(["method", "results"]),
    );
    expect(result.text).toContain(methodSentence);
    expect(result.text).toContain(resultSentence);
    expect(result.characterCount).toBeLessThanOrEqual(3_000);
  });

  it("returns no evidence when there are no missing structured fields", () => {
    const result = buildIntelligenceRepairEvidence(
      [
        chunk({
          id: "one",
          sectionId: "s1",
          sectionTitle: "Introduction",
          text: "A normal source sentence.",
        }),
      ],
      [],
    );

    expect(result.text).toBe("");
    expect(result.chunkIds).toHaveLength(0);
    expect(result.characterCount).toBe(0);
  });

  it("never exceeds the configured character budget", () => {
    const result = buildIntelligenceRepairEvidence(
      [
        chunk({
          id: "large-method",
          sectionId: "s1",
          sectionTitle: "Methodology",
          semanticRole: "method",
          text:
            "The method uses a controlled procedure and repeated evaluation. ".repeat(
              220,
            ),
        }),
        chunk({
          id: "large-results",
          sectionId: "s2",
          sectionTitle: "Results",
          semanticRole: "results",
          text:
            "The result reports measured performance and evaluation outcomes. ".repeat(
              220,
            ),
        }),
      ],
      ["method", "result"],
      { maxCharacters: 1_500, maxChunks: 2 },
    );

    expect(result.characterCount).toBeLessThanOrEqual(1_500);
    expect(result.wasTruncated).toBe(true);
  });
});

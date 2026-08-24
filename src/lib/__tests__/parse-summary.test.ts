import { parseSummary } from "@/lib/parse-summary";

describe("parseSummary", () => {
  it("parses all V2 sections without exposing metadata or markdown syntax", () => {
    const parsed = parseSummary(`# Lecture Note

<!-- intelligence-engine:v2.3 -->

## Overview

The goal is to communicate understanding.

## Key Points

- Confirm stakeholder needs. _(p. 1)_

## Main Concepts

- Analysis Phase
- Business Rules

## Key Terms

- **SRS:** Software Requirements Specification _(p. 2)_

## Section Notes

### Slide 10 — Validation Checklist (p. 6)
- Ask stakeholders to confirm:
  - Are all actors correct?
  - Are all use cases complete?
- 1 of 6 --

## Key Takeaways

- Validate the analysis before design begins. _(p. 6)_`);

    expect(parsed.version).toBe("v2");
    expect(parsed.title).toBe("Lecture Note");
    expect(parsed.prose).toBe("The goal is to communicate understanding.");
    expect(parsed.keyPoints).toEqual(["Confirm stakeholder needs. (p. 1)"]);
    expect(parsed.importantConcepts).toEqual([
      "Analysis Phase",
      "Business Rules",
    ]);
    expect(parsed.sections.map((section) => section.heading)).toEqual([
      "Key Terms",
      "Section Notes",
      "Key Takeaways",
    ]);
    expect(parsed.sections[0].items).toEqual([
      {
        text: "SRS: Software Requirements Specification (p. 2)",
        children: [],
      },
    ]);
    expect(parsed.sections[1].subsections[0]).toEqual({
      heading: "Slide 10 — Validation Checklist (p. 6)",
      paragraphs: [],
      items: [
        {
          text: "Ask stakeholders to confirm:",
          children: ["Are all actors correct?", "Are all use cases complete?"],
        },
      ],
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /intelligence-engine|svg|1 of 6|\*\*/i,
    );
  });

  it("keeps legacy summaries backwards compatible", () => {
    const parsed = parseSummary(
      "A concise overview.\n\n**Key Points:**\n- First point\n- Second point\n\n**Important Concepts:** SRS, UML",
    );

    expect(parsed).toEqual({
      version: "legacy",
      title: null,
      prose: "A concise overview.",
      keyPoints: ["First point", "Second point"],
      importantConcepts: ["SRS", "UML"],
      sections: [],
    });
  });
});

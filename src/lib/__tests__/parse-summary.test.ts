import { parseSummary } from "@/lib/parse-summary";

describe("parseSummary", () => {
  it("parses all V2 sections without exposing metadata or markdown syntax", () => {
    const parsed = parseSummary(`# Lecture Note

<!-- intelligence-engine:v2.4;mode:exam -->

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
    expect(parsed.mode).toBe("exam");
    expect(parsed.title).toBe("Lecture Note");
    expect(parsed.prose).toBe("The goal is to communicate understanding.");
    expect(parsed.overviewPoints).toEqual(["The goal is to communicate understanding."]);
    expect(parsed.keyPoints).toEqual(["Confirm stakeholder needs. (p. 1)"]);
    expect(parsed.importantConcepts).toEqual([
      "Analysis Phase",
      "Business Rules",
    ]);
    expect(parsed.topics).toEqual([]);
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

  it("parses topic-first v2.12 summaries for the focused student UI", () => {
    const parsed = parseSummary(`# DSA Cookbook

<!-- intelligence-engine:v2.12;mode:comprehensive -->

## Overview

- Algorithms begin with understanding the problem. _(p. 1)_
- Memory lets a computer retain changing information. _(p. 6)_

## Study Topics

### Algorithmic Thinking
**Simple explanation:** An algorithm is a set of instructions used to solve a problem. _(p. 5)_
**Important key points:**
- Solve the problem manually before writing code. _(p. 3)_
- Translate the reasoning into code only after the steps are clear. _(p. 3)_

### Computer Memory
**Simple explanation:** A computer needs memory to retain information while solving a problem. _(p. 6)_
**Important key points:**
- Variables provide named storage for remembered information. _(p. 7)_

## Key Takeaways
- Think before coding. _(p. 3)_`);

    expect(parsed.overviewPoints).toHaveLength(2);
    expect(parsed.keyPoints).toEqual([]);
    expect(parsed.importantConcepts).toEqual([]);
    expect(parsed.topics).toEqual([
      {
        heading: "Algorithmic Thinking",
        explanation: "An algorithm is a set of instructions used to solve a problem. (p. 5)",
        keyPoints: [
          { text: "Solve the problem manually before writing code. (p. 3)", children: [] },
          { text: "Translate the reasoning into code only after the steps are clear. (p. 3)", children: [] },
        ],
      },
      {
        heading: "Computer Memory",
        explanation: "A computer needs memory to retain information while solving a problem. (p. 6)",
        keyPoints: [
          { text: "Variables provide named storage for remembered information. (p. 7)", children: [] },
        ],
      },
    ]);
    expect(parsed.sections.map((section) => section.heading)).toEqual(["Key Takeaways"]);
  });


  it("parses v3 semantic-evidence summaries into the same topic UI contract", () => {
    const parsed = parseSummary(`# Research Notes

<!-- intelligence-engine:v3.0;mode:comprehensive -->

## Overview
- Bayesian Networks combine causal structure with probability. _(p. 2)_

## Study Topics

### Bayesian Networks
**Simple explanation:** A Bayesian Network is a graph of uncertain variables with associated probability tables. _(p. 2)_
**Important key points:**
- Nodes represent uncertain variables. _(p. 2)_
- Arcs represent causal or relevance relationships. _(p. 2)_

## Key Takeaways
- Causal structure helps combine different forms of evidence. _(p. 1)_`);

    expect(parsed.version).toBe("v3");
    expect(parsed.mode).toBe("comprehensive");
    expect(parsed.title).toBe("Research Notes");
    expect(parsed.topics).toEqual([
      {
        heading: "Bayesian Networks",
        explanation: "A Bayesian Network is a graph of uncertain variables with associated probability tables. (p. 2)",
        keyPoints: [
          { text: "Nodes represent uncertain variables. (p. 2)", children: [] },
          { text: "Arcs represent causal or relevance relationships. (p. 2)", children: [] },
        ],
      },
    ]);
    expect(parsed.sections.map((section) => section.heading)).toEqual(["Key Takeaways"]);
  });

  it("keeps legacy summaries backwards compatible", () => {
    const parsed = parseSummary(
      "A concise overview.\n\n**Key Points:**\n- First point\n- Second point\n\n**Important Concepts:** SRS, UML",
    );

    expect(parsed).toEqual({
      version: "legacy",
      mode: "comprehensive",
      title: null,
      prose: "A concise overview.",
      overviewPoints: ["A concise overview."],
      keyPoints: ["First point", "Second point"],
      importantConcepts: ["SRS", "UML"],
      topics: [],
      sections: [],
    });
  });
});

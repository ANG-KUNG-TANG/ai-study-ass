import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type ImportantConcept,
  type SectionCoverage,
} from "@/server/intelligence/grounding";
import {
  assessSummaryQuality,
} from "@/server/services/summary/summary-quality.service";

function makeFact(input: {
  id: string;
  sectionId: string;
  content: string;
  type?: AtomicFact["type"];
  importance?: number;
  page?: number;
}): AtomicFact {
  return {
    id: input.id,
    type: input.type ?? "claim",
    content: input.content,
    verbatimRequired: false,
    sourceSectionId: input.sectionId,
    evidence: [{
      id: `evidence-${input.id}`,
      sectionId: input.sectionId,
      sectionTitle: input.sectionId,
      pageNumber: input.page ?? 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus: "supported",
    confidence: 0.95,
    importanceScore: input.importance ?? 0.85,
    numericTokens: [],
  };
}

function makeSection(
  id: string,
  heading: string,
  factIds: string[],
): SectionCoverage {
  return {
    sectionId: id,
    heading,
    status: "covered",
    factIds,
    sourceUnitCount: factIds.length,
    omittedUnitCount: 0,
  };
}

function makeConcept(
  name: string,
  sectionId: string,
  importance: number,
): ImportantConcept {
  return {
    name,
    normalizedName: name.toLocaleLowerCase(),
    explanation: `${name} is an important topic in the source.`,
    sourceSectionIds: [sectionId],
    evidence: [{
      id: `concept-${name}`,
      sectionId,
      sectionTitle: sectionId,
      pageNumber: 1,
      text: `${name} is an important topic in the source.`,
    }],
    importanceScore: importance,
  };
}

function makeGrounding(): GroundedKnowledge {
  const facts = [
    makeFact({
      id: "f1",
      sectionId: "s1",
      content:
        "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      type: "definition",
      importance: 0.99,
    }),
    makeFact({
      id: "f2",
      sectionId: "s1",
      content:
        "The root bridge is selected using the lowest bridge identifier.",
      type: "rule",
      importance: 0.95,
    }),
    makeFact({
      id: "f3",
      sectionId: "s2",
      content:
        "PortFast should be enabled only on access ports connected to end devices.",
      type: "warning",
      importance: 0.90,
      page: 2,
    }),
    makeFact({
      id: "f4",
      sectionId: "s2",
      content:
        "BPDU Guard disables a protected edge port when an unexpected BPDU is received.",
      type: "relationship",
      importance: 0.88,
      page: 2,
    }),
    makeFact({
      id: "f5",
      sectionId: "s3",
      content: "The default STP bridge priority is 32768.",
      type: "number",
      importance: 0.86,
      page: 3,
    }),
    makeFact({
      id: "f6",
      sectionId: "s3",
      content:
        "A lower path cost is preferred when STP selects the best route toward the root bridge.",
      type: "rule",
      importance: 0.82,
      page: 3,
    }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.4",
    sourceHash: "source-hash",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      makeConcept("Spanning Tree Protocol", "s1", 0.99),
      makeConcept("Root Bridge", "s1", 0.95),
      makeConcept("PortFast", "s2", 0.90),
      makeConcept("BPDU Guard", "s2", 0.88),
    ],
    sections: [
      makeSection("s1", "STP Fundamentals", ["f1", "f2"]),
      makeSection("s2", "Edge Port Protection", ["f3", "f4"]),
      makeSection("s3", "Path Selection", ["f5", "f6"]),
    ],
    quality: {
      score: 0.95,
      scoreOutOf10: 9.5,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: facts.length,
      warnings: [],
    },
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  };
}

function goodArtifact() {
  return {
    summary: [
      "# STP Study Notes",
      "<!-- intelligence-engine:v2.5;mode:comprehensive -->",
      "## Overview",
      "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      "## Key Points",
      "- The root bridge is selected using the lowest bridge identifier. (p. 1)",
      "- PortFast should be enabled only on access ports connected to end devices. (p. 2)",
      "- BPDU Guard disables a protected edge port when an unexpected BPDU is received. (p. 2)",
      "- The default STP bridge priority is 32768. (p. 3)",
      "- A lower path cost is preferred when STP selects the best route toward the root bridge. (p. 3)",
      "## Main Concepts",
      "- Spanning Tree Protocol",
      "- Root Bridge",
      "- PortFast",
      "- BPDU Guard",
      "## Section Notes",
      "### STP Fundamentals",
      "- Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      "### Edge Port Protection",
      "- PortFast should be enabled only on access ports connected to end devices.",
      "### Path Selection",
      "- The default STP bridge priority is 32768.",
    ].join("\n\n"),
    keyPoints: [
      "The root bridge is selected using the lowest bridge identifier.",
      "PortFast should be enabled only on access ports connected to end devices.",
      "BPDU Guard disables a protected edge port when an unexpected BPDU is received.",
      "The default STP bridge priority is 32768.",
      "A lower path cost is preferred when STP selects the best route toward the root bridge.",
    ],
    importantConcepts: [
      "Spanning Tree Protocol",
      "Root Bridge",
      "PortFast",
      "BPDU Guard",
    ],
  };
}

describe("summary quality validation", () => {
  it("passes a faithful grounded summary with expected coverage", () => {
    const report = assessSummaryQuality({
      artifact: goodArtifact(),
      grounding: makeGrounding(),
      mode: "comprehensive",
    });

    expect(report.status).toBe("passed");
    expect(report.faithful).toBe(true);
    expect(report.coverageSufficient).toBe(true);
    expect(report.metrics.unsupportedFactualUnitCount).toBe(0);
  });

  it("fails an unsupported numeric statement", () => {
    const artifact = goodArtifact();
    artifact.summary +=
      "\n\n- The default STP bridge priority is 99999. (p. 3)";
    artifact.keyPoints.push(
      "The default STP bridge priority is 99999.",
    );

    const report = assessSummaryQuality({
      artifact,
      grounding: makeGrounding(),
      mode: "comprehensive",
    });

    expect(report.status).toBe("failed");
    expect(report.faithful).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNSUPPORTED_NUMERIC_CONTENT",
          severity: "error",
        }),
      ]),
    );
  });

  it("flags fluent factual additions that lack source support", () => {
    const artifact = goodArtifact();
    artifact.summary += [
      "",
      "## Key Takeaways",
      "STP automatically encrypts all Ethernet frames between switches.",
      "STP assigns public IP addresses to every access port.",
      "STP replaces VLAN configuration on trunk links.",
    ].join("\n\n");

    const report = assessSummaryQuality({
      artifact,
      grounding: makeGrounding(),
      mode: "comprehensive",
    });

    expect(report.status).not.toBe("passed");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNSUPPORTED_FACTUAL_CONTENT",
        }),
      ]),
    );
  });

  it("fails severe section and concept under-coverage", () => {
    const report = assessSummaryQuality({
      artifact: {
        summary: [
          "# STP",
          "## Overview",
          "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
          "## Section Notes",
          "### STP Fundamentals",
          "- Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
        ].join("\n\n"),
        keyPoints: [
          "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
        ],
        importantConcepts: ["Spanning Tree Protocol"],
      },
      grounding: makeGrounding(),
      mode: "comprehensive",
    });

    expect(report.status).toBe("failed");
    expect(report.coverageSufficient).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LOW_SECTION_COVERAGE",
          severity: "error",
        }),
        expect.objectContaining({
          code: "LOW_CONCEPT_COVERAGE",
          severity: "error",
        }),
      ]),
    );
  });

  it("uses concise mode's section budget instead of demanding all sections", () => {
    const grounding = makeGrounding();

    for (let index = 4; index <= 12; index += 1) {
      const sectionId = `s${index}`;
      const factId = `f-extra-${index}`;
      grounding.facts.push(
        makeFact({
          id: factId,
          sectionId,
          content:
            `Section ${index} explains a supported networking rule for redundant switch design.`,
          type: "rule",
          importance: 0.60 - index * 0.01,
          page: index,
        }),
      );
      grounding.sections.push(
        makeSection(sectionId, `Section ${index}`, [factId]),
      );
    }

    const artifact = goodArtifact();
    artifact.summary += [
      "### Section 4",
      "### Section 6",
      "### Section 7",
      "### Section 9",
      "### Section 10",
      "### Section 12",
    ].join("\n\n");

    const report = assessSummaryQuality({
      artifact,
      grounding,
      mode: "concise",
    });

    expect(report.metrics.requiredSectionCount).toBe(8);
    expect(
      report.issues.some(
        (issue) =>
          issue.code === "LOW_SECTION_COVERAGE" &&
          issue.severity === "error",
      ),
    ).toBe(false);
  });

  it("ignores standard grounded-notes boilerplate", () => {
    const artifact = goodArtifact();
    artifact.summary = artifact.summary.replace(
      "Spanning Tree Protocol prevents Layer 2 switching loops in redundant Ethernet topologies.",
      "These notes organise the verified knowledge extracted from STP Study Notes.",
    );

    const report = assessSummaryQuality({
      artifact,
      grounding: makeGrounding(),
      mode: "comprehensive",
    });

    expect(report.metrics.unsupportedFactualUnitCount).toBe(0);
  });
});

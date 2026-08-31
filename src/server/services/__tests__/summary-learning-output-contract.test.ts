import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  buildGroundedStudyNotes,
} from "@/server/services/summary/grounded-study-notes.service";

function fact(input: {
  id: string;
  sectionId: string;
  type: AtomicFact["type"];
  content: string;
  importance?: number;
}): AtomicFact {
  return {
    id: input.id,
    type: input.type,
    content: input.content,
    verbatimRequired: false,
    sourceSectionId: input.sectionId,
    evidence: [{
      id: `e-${input.id}`,
      sectionId: input.sectionId,
      sectionTitle: input.sectionId,
      pageNumber: 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus: "supported",
    confidence: 0.96,
    importanceScore: input.importance ?? 0.88,
    numericTokens: input.content.match(/[-+]?\d+(?:\.\d+)?(?:\s*%)?/gu) ?? [],
  };
}

function grounding(): GroundedKnowledge {
  const facts = [
    fact({ id: "definition", sectionId: "core", type: "definition", content: "A resolver maps a readable service name to a network address used by a client.", importance: 0.99 }),
    fact({ id: "rule", sectionId: "core", type: "rule", content: "Clients use the resolved address to contact the intended application server.", importance: 0.96 }),
    fact({ id: "step1", sectionId: "steps", type: "procedure_step", content: "Configure the client with the resolver address.", importance: 0.9 }),
    fact({ id: "step2", sectionId: "steps", type: "procedure_step", content: "Add the service-name record to the resolver.", importance: 0.9 }),
    fact({ id: "compare", sectionId: "compare", type: "relationship", content: "Static resolution uses a fixed record, whereas dynamic resolution can update mappings automatically.", importance: 0.91 }),
    fact({ id: "example", sectionId: "examples", type: "example", content: "For example, a client can resolve portal.example before opening the web application.", importance: 0.78 }),
    fact({ id: "warning", sectionId: "warnings", type: "warning", content: "Do not assign a reserved network identifier to a host interface.", importance: 0.94 }),
    fact({ id: "number", sectionId: "numbers", type: "number", content: "The retry threshold is 80 percent before fallback begins.", importance: 0.86 }),
    fact({ id: "reference", sectionId: "reference", type: "rule", content: "Use `resolver --safe` when the configuration requires the safe resolver mode.", importance: 0.8 }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v3.1-test",
    sourceHash: "learning-output-contract",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [{
      term: "Resolver",
      definition: "A service that maps a readable name to a network address for a client.",
      sourceSectionId: "core",
      evidence: facts[0]!.evidence,
      qualification: "explicit_definition",
      confidence: 0.95,
    }],
    concepts: [{
      name: "Name Resolution",
      normalizedName: "name resolution",
      explanation: facts[0]!.content,
      sourceSectionIds: ["core"],
      evidence: facts[0]!.evidence,
      importanceScore: 0.98,
    }],
    sections: [
      { sectionId: "core", heading: "Name Resolution", status: "covered", factIds: ["definition", "rule"], sourceUnitCount: 2, omittedUnitCount: 0 },
      { sectionId: "steps", heading: "Configuration Steps", status: "covered", factIds: ["step1", "step2"], sourceUnitCount: 2, omittedUnitCount: 0 },
      { sectionId: "compare", heading: "Static vs Dynamic Resolution", status: "covered", factIds: ["compare"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "examples", heading: "Example", status: "covered", factIds: ["example"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "warnings", heading: "Warnings", status: "covered", factIds: ["warning"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "numbers", heading: "Threshold", status: "covered", factIds: ["number"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "reference", heading: "Configuration Reference", status: "covered", factIds: ["reference"], sourceUnitCount: 1, omittedUnitCount: 0 },
    ],
    quality: {
      score: 0.97,
      scoreOutOf10: 9.7,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: facts.length,
      warnings: [],
    },
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
  };
}

describe("summary v3.2 learner-facing output contract", () => {
  it("publishes the stable core learner sections and keeps optional evidence in dedicated sections", () => {
    const notes = buildGroundedStudyNotes(grounding(), null, "Resolver Study Guide", {
      mode: "comprehensive",
    });

    expect(notes.summary).toContain("<!-- intelligence-engine:v3.2;mode:comprehensive -->");
    expect(notes.summary).toContain("## Overview");
    expect(notes.summary).toContain("## Key Points");
    expect(notes.summary).toContain("## Key Concepts");
    expect(notes.summary).toContain("## Key Terms");
    expect(notes.summary).toContain("## Detailed Study Notes");
    expect(notes.summary).toContain("## Processes / Steps");
    expect(notes.summary).toContain("## Comparisons");
    expect(notes.summary).toContain("## Examples");
    expect(notes.summary).toContain("## Warnings / Common Mistakes");
    expect(notes.summary).toContain("## Important Numbers / Formulas");
    expect(notes.summary).toContain("## Practical Reference");
    expect(notes.summary).not.toContain("## Study Topics");
    expect(notes.summary).not.toContain("## Key Takeaways");
  });

  it("does not promote an example-only entity into Key Concepts", () => {
    const source = grounding();
    source.concepts.push({
      name: "portal.example",
      normalizedName: "portal.example",
      explanation: "For example, a client can resolve portal.example before opening the web application.",
      sourceSectionIds: ["examples"],
      evidence: source.facts.find((item) => item.id === "example")!.evidence,
      importanceScore: 0.93,
    });

    const notes = buildGroundedStudyNotes(source, null, "Resolver Study Guide", {
      mode: "comprehensive",
    });

    expect(notes.importantConcepts).not.toContain("portal.example");
    expect(notes.summary).toContain("## Examples");
  });
});

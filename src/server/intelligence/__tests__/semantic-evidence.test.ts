import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  buildSemanticEvidenceMap,
  semanticEvidenceExplanationFit,
} from "@/server/intelligence/semantic-evidence";

function makeFact(input: {
  id: string;
  sectionId: string;
  content: string;
  type?: AtomicFact["type"];
  importance?: number;
}): AtomicFact {
  return {
    id: input.id,
    type: input.type ?? "claim",
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
    importanceScore: input.importance ?? 0.9,
    numericTokens: input.content.match(/\b\d+(?:\.\d+)*%?\b/gu) ?? [],
  };
}

function grounding(): GroundedKnowledge {
  const facts = [
    makeFact({
      id: "authors",
      sectionId: "title",
      content: "Martin Neil and Norman Fenton (Agena Ltd and Queen Mary, University of London)",
      importance: 0.99,
    }),
    makeFact({
      id: "result",
      sectionId: "abstract",
      type: "result",
      content: "The validation found 95% correlation between actual and predicted defects.",
      importance: 0.99,
    }),
    makeFact({
      id: "method",
      sectionId: "method",
      content: "The defect model was built using a mixture of project data and expert judgements.",
      importance: 0.97,
    }),
    makeFact({
      id: "cause",
      sectionId: "method",
      type: "relationship",
      content: "Understanding cause and effect is a basic form of human knowledge underlying our decisions.",
      importance: 0.99,
    }),
    makeFact({ id: "think-intro", sectionId: "think", content: "The THINK Framework uses five questions to guide problem solving.", importance: 0.96 }),
    makeFact({ id: "t", sectionId: "think-t", type: "objective", content: "Understand the Task before deciding how to solve it.", importance: 0.92 }),
    makeFact({ id: "h", sectionId: "think-h", type: "objective", content: "Human Solution asks how the problem would be solved without programming.", importance: 0.92 }),
    makeFact({ id: "i", sectionId: "think-i", type: "objective", content: "Identify Important Information that must be remembered while solving the problem.", importance: 0.92 }),
    makeFact({ id: "n", sectionId: "think-n", type: "objective", content: "Name the Memory by choosing variables or data structures for remembered information.", importance: 0.92 }),
    makeFact({ id: "k", sectionId: "think-k", type: "objective", content: "Keep Processing until the task is complete.", importance: 0.92 }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.7",
    sourceHash: "semantic-evidence-fixture",
    documentKind: "research_paper",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [],
    sections: [
      { sectionId: "title", heading: "Improved Software Defect Prediction", status: "covered", factIds: ["authors"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "abstract", heading: "Abstract", status: "covered", factIds: ["result"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "method", heading: "2.2 Building the BN Model", status: "covered", factIds: ["method", "cause"], sourceUnitCount: 2, omittedUnitCount: 0 },
      { sectionId: "think", heading: "The THINK Framework", status: "covered", factIds: ["think-intro"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "think-t", heading: "T", status: "covered", factIds: ["t"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "think-h", heading: "Human Solution", status: "covered", factIds: ["h"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "think-i", heading: "Identify Important Information", status: "covered", factIds: ["i"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "think-n", heading: "N", status: "covered", factIds: ["n"], sourceUnitCount: 1, omittedUnitCount: 0 },
      { sectionId: "think-k", heading: "Keep Processing", status: "covered", factIds: ["k"], sourceUnitCount: 1, omittedUnitCount: 0 },
    ],
    quality: {
      score: 0.98,
      scoreOutOf10: 9.8,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: facts.length,
      warnings: [],
    },
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
  };
}

describe("semantic evidence map", () => {
  it("separates source structure and metadata from learning evidence", () => {
    const source = grounding();
    const map = buildSemanticEvidenceMap({
      sections: source.sections,
      facts: source.facts,
      concepts: source.concepts,
      keyTerms: source.keyTerms,
      documentTitle: "Improved Software Defect Prediction",
    });

    expect(map.sectionRoleById.get("title")).toBe("metadata");
    expect(map.sectionRoleById.get("abstract")).toBe("structural");
    expect(map.unitsByFactId.get("authors")?.role).toBe("metadata");
    expect(map.unitsByFactId.get("result")?.role).toBe("finding");
  });

  it("does not let importance alone make an unrelated fact a topic explanation", () => {
    const source = grounding();
    const map = buildSemanticEvidenceMap({
      sections: source.sections,
      facts: source.facts,
      concepts: source.concepts,
      keyTerms: source.keyTerms,
    });
    const cause = map.unitsByFactId.get("cause")!;
    const method = map.unitsByFactId.get("method")!;

    expect(semanticEvidenceExplanationFit({
      heading: "Building the BN Model",
      unit: cause,
      kind: "topic",
    }).passed).toBe(false);
    expect(semanticEvidenceExplanationFit({
      heading: "Building the BN Model",
      unit: method,
      kind: "topic",
    }).passed).toBe(true);
  });

  it("groups framework components under their parent framework", () => {
    const source = grounding();
    const map = buildSemanticEvidenceMap({
      sections: source.sections,
      facts: source.facts,
      concepts: source.concepts,
      keyTerms: source.keyTerms,
    });
    const think = map.frameworks.find((item) => item.parentSectionId === "think");

    expect(think?.componentSectionIds).toEqual([
      "think-t",
      "think-h",
      "think-i",
      "think-n",
      "think-k",
    ]);
    expect(map.unitsByFactId.get("t")?.role).toBe("framework_component");
    expect(map.unitsByFactId.get("n")?.role).toBe("framework_component");
  });
  it("does not treat generic container words as topic alignment", () => {
    const source = grounding();
    const map = buildSemanticEvidenceMap({
      sections: source.sections,
      facts: source.facts,
      concepts: source.concepts,
      keyTerms: source.keyTerms,
    });
    const method = map.unitsByFactId.get("method")!;

    expect(semanticEvidenceExplanationFit({
      heading: "Phase Model",
      unit: method,
      kind: "topic",
    }).passed).toBe(false);
  });

  it("does not classify prose about a formula language as mathematical formula evidence", () => {
    const source = grounding();
    source.facts.push(makeFact({
      id: "formula-prose",
      sectionId: "method",
      type: "formula",
      content: "The formula language of the toolset makes custom quality indicators feasible.",
      importance: 0.93,
    }));
    source.sections.find((section) => section.sectionId === "method")!.factIds.push("formula-prose");

    const map = buildSemanticEvidenceMap({
      sections: source.sections,
      facts: source.facts,
      concepts: source.concepts,
      keyTerms: source.keyTerms,
    });

    expect(map.unitsByFactId.get("formula-prose")?.role).not.toBe("formula");
  });

  it("classifies section-navigation prose as transition rather than learning evidence", () => {
    const source = grounding();
    source.facts.push(makeFact({
      id: "navigation",
      sectionId: "method",
      content: "An experimental validation of defect predictions is described in Section 6.",
      importance: 0.95,
    }));
    source.sections.find((section) => section.sectionId === "method")!.factIds.push("navigation");

    const map = buildSemanticEvidenceMap({
      sections: source.sections,
      facts: source.facts,
      concepts: source.concepts,
      keyTerms: source.keyTerms,
    });

    expect(map.unitsByFactId.get("navigation")?.role).toBe("transition");
  });

});

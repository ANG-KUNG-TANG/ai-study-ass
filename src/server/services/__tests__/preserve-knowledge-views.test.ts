import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  buildGroundedConceptMap,
} from "@/server/services/grounded-concept-map.service";
import {
  buildGroundedKnowledgeGraphResult,
} from "@/server/services/grounded-knowledge-graph.service";

function makeFact(
  id: string,
  content: string,
): AtomicFact {
  return {
    id,
    type: "relationship",
    content,
    verbatimRequired: false,
    sourceSectionId: "s1",
    evidence: [{
      id: `e-${id}`,
      sectionId: "s1",
      sectionTitle: "Switching",
      pageNumber: 1,
      text: content,
    }],
    evidenceType: "stated",
    verificationStatus:
      "supported",
    confidence: 0.96,
    importanceScore: 0.95,
    numericTokens: [],
  };
}

function grounding():
  GroundedKnowledge {
  const relation = makeFact(
    "f1",
    "Spanning Tree Protocol prevents Switching Loop.",
  );

  return {
    schemaVersion:
      GROUNDING_SCHEMA_VERSION,
    pipelineVersion:
      "intelligence-v2.4",
    sourceHash: "source",
    documentKind:
      "lecture_notes",
    sourceLanguage: "en",
    facts: [relation],
    keyTerms: [{
      term: "STP",
      definition:
        "Spanning Tree Protocol",
      sourceSectionId: "s1",
      evidence: [{
        id: "term-stp",
        sectionId: "s1",
        sectionTitle: "Switching",
        pageNumber: 1,
        text:
          "STP means Spanning Tree Protocol.",
      }],
      qualification:
        "explicit_definition",
      confidence: 0.95,
    }],
    concepts: [
      {
        name:
          "Spanning Tree Protocol",
        normalizedName:
          "spanning tree protocol",
        explanation:
          "A switching protocol.",
        sourceSectionIds: ["s1"],
        evidence:
          relation.evidence,
        importanceScore: 0.95,
      },
      {
        name:
          "Switching Loop",
        normalizedName:
          "switching loop",
        explanation:
          "A Layer 2 loop.",
        sourceSectionIds: ["s1"],
        evidence:
          relation.evidence,
        importanceScore: 0.9,
      },
    ],
    sections: [{
      sectionId: "s1",
      heading: "Switching",
      status: "covered",
      factIds: ["f1"],
      sourceUnitCount: 1,
      omittedUnitCount: 0,
    }],
    quality: {
      score: 0.95,
      scoreOutOf10: 9.5,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: 1,
      warnings: [],
    },
    createdAt: new Date(
      "2026-08-27T00:00:00.000Z",
    ),
  };
}

describe(
  "Concept Map and Knowledge Graph separation",
  () => {
    it(
      "keeps Concept Map source-structural while Knowledge Graph adds semantic edges",
      () => {
        const source =
          grounding();
        const conceptMap =
          buildGroundedConceptMap(
            source,
          );
        const graph =
          buildGroundedKnowledgeGraphResult(
            source,
          ).graph;

        expect(
          conceptMap.edges.every(
            (edge) =>
              edge.type ===
                "contains" ||
              edge.type ===
                "mentions",
          ),
        ).toBe(true);

        expect(
          conceptMap.nodes.some(
            (node) =>
              node.type === "term",
          ),
        ).toBe(false);

        expect(
          graph.edges.some(
            (edge) =>
              edge.type ===
              "prevents",
          ),
        ).toBe(true);
      },
    );
  },
);

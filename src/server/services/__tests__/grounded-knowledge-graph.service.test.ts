import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type ImportantConcept,
  type QualifiedTerm,
} from "@/server/intelligence/grounding";
import {
  buildGroundedKnowledgeGraphResult,
} from "@/server/services/grounded-knowledge-graph.service";

function makeFact(input: {
  id: string;
  sectionId?: string;
  content: string;
  type?: AtomicFact["type"];
  importance?: number;
  supported?: boolean;
}): AtomicFact {
  const sectionId =
    input.sectionId ?? "s1";

  return {
    id: input.id,
    type:
      input.type ?? "claim",
    content: input.content,
    verbatimRequired: false,
    sourceSectionId: sectionId,
    evidence: [{
      id: `e-${input.id}`,
      sectionId,
      sectionTitle: sectionId,
      pageNumber: 1,
      text: input.content,
    }],
    evidenceType: "stated",
    verificationStatus:
      input.supported === false
        ? "unsupported"
        : "supported",
    confidence: 0.96,
    importanceScore:
      input.importance ?? 0.9,
    numericTokens: [],
  };
}

function makeConcept(
  name: string,
  sectionId = "s1",
  evidence = true,
): ImportantConcept {
  return {
    name,
    normalizedName:
      name.toLowerCase(),
    explanation:
      `${name} grounded explanation`,
    sourceSectionIds: [sectionId],
    evidence:
      evidence
        ? [{
            id:
              `concept-${name}`,
            sectionId,
            sectionTitle:
              sectionId,
            pageNumber: 1,
            text:
              `${name} appears in the source.`,
          }]
        : [],
    importanceScore: 0.9,
  };
}

function makeTerm(
  term: string,
  definition: string,
  sectionId = "s1",
): QualifiedTerm {
  return {
    term,
    definition,
    sourceSectionId: sectionId,
    evidence: [{
      id: `term-${term}`,
      sectionId,
      sectionTitle: sectionId,
      pageNumber: 1,
      text: `${term}: ${definition}`,
    }],
    qualification:
      "explicit_definition",
    confidence: 0.95,
  };
}

function makeGrounding(
  overrides: Partial<GroundedKnowledge> = {},
): GroundedKnowledge {
  const facts = [
    makeFact({
      id: "f1",
      content:
        "Spanning Tree Protocol prevents Switching Loop.",
      type: "relationship",
    }),
  ];

  return {
    schemaVersion:
      GROUNDING_SCHEMA_VERSION,
    pipelineVersion:
      "intelligence-v2.4",
    sourceHash: "source-hash",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      makeConcept(
        "Spanning Tree Protocol",
      ),
      makeConcept(
        "Switching Loop",
      ),
    ],
    sections: [{
      sectionId: "s1",
      heading: "Switching",
      status: "covered",
      factIds: facts.map(
        (fact) => fact.id,
      ),
      sourceUnitCount: facts.length,
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
      artifactCount: facts.length,
      warnings: [],
    },
    createdAt: new Date(
      "2026-08-27T00:00:00.000Z",
    ),
    ...overrides,
  };
}

function semanticEdges(
  grounding: GroundedKnowledge,
) {
  return buildGroundedKnowledgeGraphResult(
    grounding,
  ).graph.edges.filter(
    (edge) =>
      !["contains", "mentions"]
        .includes(edge.type),
  );
}

describe(
  "grounded Knowledge Graph quality",
  () => {
    it(
      "keeps the document evidence structure",
      () => {
        const result =
          buildGroundedKnowledgeGraphResult(
            makeGrounding(),
          );

        expect(
          result.graph.nodes.some(
            (node) =>
              node.id ===
              "grounded-document",
          ),
        ).toBe(true);
        expect(
          result.graph.edges.some(
            (edge) =>
              edge.from ===
                "grounded-document" &&
              edge.to === "s1" &&
              edge.type ===
                "contains",
          ),
        ).toBe(true);
      },
    );

    it(
      "creates an evidence-backed directed semantic edge",
      () => {
        const source =
          makeGrounding();
        const edge =
          semanticEdges(source).find(
            (candidate) =>
              candidate.type ===
              "prevents",
          );

        expect(edge).toBeDefined();
        expect(
          edge?.evidenceIds,
        ).toContain("e-f1");
        expect(
          buildGroundedKnowledgeGraphResult(
            source,
          ).quality
            .semanticEdgeEvidenceCoverage,
        ).toBe(1);
      },
    );

    it(
      "does not invent a semantic edge from co-occurrence",
      () => {
        const base =
          makeGrounding();
        const fact =
          makeFact({
            id: "cooccur",
            content:
              "VLAN and Spanning Tree Protocol are discussed in this section.",
            type: "claim",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [fact],
          concepts: [
            makeConcept("VLAN"),
            makeConcept(
              "Spanning Tree Protocol",
            ),
          ],
          sections: [{
            ...base.sections[0]!,
            factIds: [fact.id],
          }],
        };

        expect(
          semanticEdges(source),
        ).toHaveLength(0);
      },
    );

    it(
      "validates relationship direction for is-a statements",
      () => {
        const base =
          makeGrounding();
        const fact =
          makeFact({
            id: "isa",
            content:
              "Rapid Spanning Tree Protocol is a type of Spanning Tree Protocol.",
            type: "relationship",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [fact],
          concepts: [
            makeConcept(
              "Rapid Spanning Tree Protocol",
            ),
            makeConcept(
              "Spanning Tree Protocol",
            ),
          ],
          sections: [{
            ...base.sections[0]!,
            factIds: [fact.id],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );
        const edge =
          result.graph.edges.find(
            (candidate) =>
              candidate.type ===
              "is_a",
          );

        const fromNode =
          result.graph.nodes.find(
            (node) =>
              node.id === edge?.from,
          );
        const toNode =
          result.graph.nodes.find(
            (node) =>
              node.id === edge?.to,
          );

        expect(
          fromNode?.label,
        ).toBe(
          "Rapid Spanning Tree Protocol",
        );
        expect(
          toNode?.label,
        ).toBe(
          "Spanning Tree Protocol",
        );
      },
    );

    it(
      "reverses passive semantic statements correctly",
      () => {
        const base =
          makeGrounding();
        const fact =
          makeFact({
            id: "passive",
            content:
              "Switching Loop is prevented by Spanning Tree Protocol.",
            type: "relationship",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [fact],
          sections: [{
            ...base.sections[0]!,
            factIds: [fact.id],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );
        const edge =
          result.graph.edges.find(
            (candidate) =>
              candidate.type ===
              "prevents",
          );

        const from =
          result.graph.nodes.find(
            (node) =>
              node.id === edge?.from,
          );
        const to =
          result.graph.nodes.find(
            (node) =>
              node.id === edge?.to,
          );

        expect(from?.label).toBe(
          "Spanning Tree Protocol",
        );
        expect(to?.label).toBe(
          "Switching Loop",
        );
      },
    );

    it(
      "merges acronym term aliases into an existing concept node",
      () => {
        const base =
          makeGrounding();
        const source: GroundedKnowledge = {
          ...base,
          keyTerms: [
            makeTerm(
              "STP",
              "Spanning Tree Protocol",
            ),
          ],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );
        const semanticNodes =
          result.graph.nodes.filter(
            (node) =>
              node.type ===
                "concept" ||
              node.type === "term",
          );
        const stpRelated =
          semanticNodes.filter(
            (node) =>
              node.label ===
                "Spanning Tree Protocol" ||
              node.label === "STP",
          );

        expect(
          stpRelated,
        ).toHaveLength(1);
      },
    );

    it(
      "creates grounded term-only nodes",
      () => {
        const base =
          makeGrounding();
        const source: GroundedKnowledge = {
          ...base,
          keyTerms: [
            makeTerm(
              "Bridge ID",
              "A bridge identifier used in root election.",
            ),
          ],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );

        expect(
          result.graph.nodes.some(
            (node) =>
              node.type === "term" &&
              node.label ===
                "Bridge ID",
          ),
        ).toBe(true);
      },
    );

    it(
      "omits ungrounded semantic nodes and reports them",
      () => {
        const base =
          makeGrounding();
        const source: GroundedKnowledge = {
          ...base,
          concepts: [
            ...base.concepts,
            makeConcept(
              "Ungrounded Concept",
              "s1",
              false,
            ),
          ],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );

        expect(
          result.graph.nodes.some(
            (node) =>
              node.label ===
              "Ungrounded Concept",
          ),
        ).toBe(false);
        expect(
          result.quality
            .omittedUngroundedNodeCount,
        ).toBeGreaterThan(0);
        expect(
          result.quality.status,
        ).toBe("warning");
      },
    );

    it(
      "merges duplicate semantic edges and evidence",
      () => {
        const base =
          makeGrounding();
        const first =
          makeFact({
            id: "duplicate-1",
            content:
              "Spanning Tree Protocol prevents Switching Loop.",
            type: "relationship",
          });
        const second =
          makeFact({
            id: "duplicate-2",
            content:
              "Spanning Tree Protocol prevents Switching Loop.",
            type: "relationship",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [first, second],
          sections: [{
            ...base.sections[0]!,
            factIds: [
              first.id,
              second.id,
            ],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );
        const edges =
          semanticEdges(source).filter(
            (edge) =>
              edge.type ===
              "prevents",
          );

        expect(edges).toHaveLength(1);
        expect(
          edges[0]?.evidenceIds,
        ).toEqual(
          expect.arrayContaining([
            "e-duplicate-1",
            "e-duplicate-2",
          ]),
        );
        expect(
          result.quality
            .duplicateEdgeCount,
        ).toBe(1);
      },
    );

    it(
      "removes directly conflicting causal edges",
      () => {
        const base =
          makeGrounding();
        const causes =
          makeFact({
            id: "causes",
            content:
              "Spanning Tree Protocol causes Switching Loop.",
            type: "relationship",
          });
        const prevents =
          makeFact({
            id: "prevents",
            content:
              "Spanning Tree Protocol prevents Switching Loop.",
            type: "relationship",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [causes, prevents],
          sections: [{
            ...base.sections[0]!,
            factIds: [
              causes.id,
              prevents.id,
            ],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );

        expect(
          result.graph.edges.some(
            (edge) =>
              edge.type ===
                "causes" ||
              edge.type ===
                "prevents",
          ),
        ).toBe(false);
        expect(
          result.quality
            .conflictingEdgeCount,
        ).toBeGreaterThan(0);
        expect(
          result.quality.status,
        ).toBe("warning");
      },
    );

    it(
      "removes reverse is-a cycles",
      () => {
        const base =
          makeGrounding();
        const first =
          makeFact({
            id: "isa-1",
            content:
              "Rapid STP is a type of STP.",
            type: "relationship",
          });
        const second =
          makeFact({
            id: "isa-2",
            content:
              "STP is a type of Rapid STP.",
            type: "relationship",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [first, second],
          keyTerms: [
            makeTerm(
              "STP",
              "Spanning Tree Protocol",
            ),
            makeTerm(
              "Rapid STP",
              "Rapid Spanning Tree Protocol",
            ),
          ],
          concepts: [],
          sections: [{
            ...base.sections[0]!,
            factIds: [
              first.id,
              second.id,
            ],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );

        expect(
          result.graph.edges.some(
            (edge) =>
              edge.type === "is_a",
          ),
        ).toBe(false);
        expect(
          result.quality
            .conflictingEdgeCount,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "reports unsafe relationship facts that cannot be directed",
      () => {
        const base =
          makeGrounding();
        const fact =
          makeFact({
            id: "unsafe",
            content:
              "VLAN is associated in several ways with Spanning Tree Protocol during network design.",
            type: "relationship",
          });

        const source: GroundedKnowledge = {
          ...base,
          facts: [fact],
          concepts: [
            makeConcept("VLAN"),
            makeConcept(
              "Spanning Tree Protocol",
            ),
          ],
          sections: [{
            ...base.sections[0]!,
            factIds: [fact.id],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );

        expect(
          result.quality
            .skippedUnsafeRelationshipCount,
        ).toBe(1);
        expect(
          result.quality.status,
        ).toBe("warning");
      },
    );

    it(
      "keeps Unicode grounded nodes even when no safe language-specific relation can be parsed",
      () => {
        const base =
          makeGrounding();
        const source: GroundedKnowledge = {
          ...base,
          sourceLanguage: "th",
          facts: [],
          keyTerms: [],
          concepts: [
            makeConcept(
              "โปรโตคอลต้นไม้ครอบคลุม",
            ),
          ],
          sections: [{
            ...base.sections[0]!,
            factIds: [],
          }],
        };

        const result =
          buildGroundedKnowledgeGraphResult(
            source,
          );

        expect(
          result.graph.nodes.some(
            (node) =>
              node.label ===
              "โปรโตคอลต้นไม้ครอบคลุม",
          ),
        ).toBe(true);
        expect(
          result.quality
            .semanticNodeCount,
        ).toBe(1);
      },
    );
  },
);

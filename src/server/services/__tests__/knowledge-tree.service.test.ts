import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
  type ImportantConcept,
  type QualifiedTerm,
} from "@/server/intelligence/grounding";
import {
  buildGroundedKnowledgeTree,
} from "@/server/services/knowledge/knowledge-tree.service";
import type {
  KnowledgeTreeNodeData,
} from "@/server/types/Knowledge";

function makeFact(input: {
  id: string;
  sectionId: string;
  content: string;
  importance?: number;
  type?: AtomicFact["type"];
  supported?: boolean;
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
    verificationStatus:
      input.supported === false
        ? "unsupported"
        : "supported",
    confidence: 0.95,
    importanceScore: input.importance ?? 0.9,
    numericTokens: [],
  };
}

function makeConcept(input: {
  name: string;
  sectionIds?: string[];
  importance?: number;
  evidence?: boolean;
}): ImportantConcept {
  const sectionIds = input.sectionIds ?? ["s1"];

  return {
    name: input.name,
    normalizedName: input.name.toLowerCase(),
    explanation: `Grounded explanation of ${input.name}.`,
    sourceSectionIds: sectionIds,
    evidence:
      input.evidence === false
        ? []
        : [{
            id: `concept-${input.name}`,
            sectionId: sectionIds[0] ?? "s1",
            sectionTitle: sectionIds[0] ?? "s1",
            pageNumber: 1,
            text: `${input.name} is discussed here.`,
          }],
    importanceScore: input.importance ?? 0.9,
  };
}

function makeTerm(
  name: string,
  definition: string,
  sectionId = "s1",
): QualifiedTerm {
  return {
    term: name,
    definition,
    sourceSectionId: sectionId,
    evidence: [{
      id: `term-${name}`,
      sectionId,
      sectionTitle: sectionId,
      pageNumber: 1,
      text: `${name}: ${definition}`,
    }],
    qualification: "explicit_definition",
    confidence: 0.95,
  };
}

function makeGrounding(
  overrides: Partial<GroundedKnowledge> = {},
): GroundedKnowledge {
  const facts = [
    makeFact({
      id: "f1",
      sectionId: "s1",
      content:
        "Spanning Tree Protocol prevents Layer 2 switching loops.",
      type: "definition",
      importance: 0.95,
    }),
    makeFact({
      id: "f2",
      sectionId: "s2",
      content:
        "PortFast should be enabled on access ports connected to end devices.",
      type: "warning",
      importance: 0.9,
    }),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.4",
    sourceHash: "source-hash",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [
      makeTerm(
        "STP",
        "Spanning Tree Protocol prevents Layer 2 switching loops.",
      ),
      makeTerm(
        "PortFast",
        "An edge-port feature used on access ports.",
        "s2",
      ),
    ],
    concepts: [
      makeConcept({
        name: "Spanning Tree Protocol",
        sectionIds: ["s1"],
        importance: 0.98,
      }),
    ],
    sections: [
      {
        sectionId: "s1",
        heading: "Switching Fundamentals",
        status: "covered",
        factIds: ["f1"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s2",
        heading: "Edge Port Protection",
        status: "covered",
        factIds: ["f2"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
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
    ...overrides,
  };
}

function flatten(
  root: KnowledgeTreeNodeData | null,
): KnowledgeTreeNodeData[] {
  if (!root) return [];

  return [
    root,
    ...root.children.flatMap((child) =>
      flatten(child),
    ),
  ];
}

function findNode(
  root: KnowledgeTreeNodeData | null,
  label: string,
): KnowledgeTreeNodeData | undefined {
  return flatten(root).find(
    (node) => node.label === label,
  );
}

describe("grounded Knowledge Tree", () => {
  it("builds a connected root -> topic -> grounded knowledge tree", () => {
    const tree = buildGroundedKnowledgeTree(
      makeGrounding(),
    );
    const nodes = flatten(tree.root);

    expect(tree.root?.type).toBe("root");
    expect(
      nodes.some(
        (node) =>
          node.type === "topic" &&
          node.label === "Switching Fundamentals",
      ),
    ).toBe(true);
    expect(
      nodes.some(
        (node) =>
          node.type === "concept" &&
          node.label === "Spanning Tree Protocol",
      ),
    ).toBe(true);
    expect(tree.quality.orphanCount).toBe(0);
    expect(tree.quality.status).toBe("passed");
  });

  it("merges acronym aliases instead of creating duplicate concept branches", () => {
    const tree = buildGroundedKnowledgeTree(
      makeGrounding(),
    );
    const nodes = flatten(tree.root);
    const stpNodes = nodes.filter(
      (node) =>
        node.label === "STP" ||
        node.label === "Spanning Tree Protocol",
    );

    expect(stpNodes).toHaveLength(1);
    expect(
      tree.quality.duplicateAliasCount,
    ).toBeGreaterThanOrEqual(1);
  });

  it("creates a broader-to-narrower edge only when a supported fact states it", () => {
    const base = makeGrounding();
    const relationship = makeFact({
      id: "hierarchy",
      sectionId: "s1",
      content:
        "Rapid Spanning Tree Protocol is a type of Spanning Tree Protocol.",
      type: "relationship",
      importance: 0.95,
    });

    const tree = buildGroundedKnowledgeTree({
      ...base,
      facts: [...base.facts, relationship],
      concepts: [
        makeConcept({
          name: "Spanning Tree Protocol",
          sectionIds: ["s1"],
        }),
        makeConcept({
          name: "Rapid Spanning Tree Protocol",
          sectionIds: ["s1"],
        }),
      ],
    });

    const parent = findNode(
      tree.root,
      "Spanning Tree Protocol",
    );
    const child = findNode(
      tree.root,
      "Rapid Spanning Tree Protocol",
    );

    expect(
      parent?.children.some(
        (node) =>
          node.id === child?.id &&
          node.relationToParent ===
            "explicit_hierarchy",
      ),
    ).toBe(true);
    expect(
      child?.relationEvidenceIds,
    ).toContain("e-hierarchy");
  });

  it("does not invent hierarchy from simple co-occurrence", () => {
    const base = makeGrounding();
    const cooccurrence = makeFact({
      id: "cooccur",
      sectionId: "s1",
      content:
        "VLAN and Spanning Tree Protocol are both discussed in switching.",
      type: "relationship",
      importance: 0.9,
    });

    const tree = buildGroundedKnowledgeTree({
      ...base,
      facts: [...base.facts, cooccurrence],
      concepts: [
        makeConcept({
          name: "VLAN",
          sectionIds: ["s1"],
        }),
        makeConcept({
          name: "Spanning Tree Protocol",
          sectionIds: ["s1"],
        }),
      ],
    });

    const vlan = findNode(tree.root, "VLAN");
    const stp = findNode(
      tree.root,
      "Spanning Tree Protocol",
    );

    expect(vlan?.relationToParent).toBe(
      "topic_group",
    );
    expect(stp?.relationToParent).toBe(
      "topic_group",
    );
    expect(
      tree.quality.explicitHierarchyCount,
    ).toBe(0);
  });

  it("excludes unsupported facts from the tree", () => {
    const base = makeGrounding();
    const unsupported = makeFact({
      id: "unsupported",
      sectionId: "s1",
      content:
        "An unsupported networking claim should never be shown.",
      importance: 0.99,
      supported: false,
    });

    const tree = buildGroundedKnowledgeTree({
      ...base,
      facts: [...base.facts, unsupported],
    });

    expect(
      flatten(tree.root).some(
        (node) => node.id === "unsupported",
      ),
    ).toBe(false);
  });

  it("omits low-importance facts while retaining major concepts", () => {
    const base = makeGrounding();
    const minor = makeFact({
      id: "minor",
      sectionId: "s1",
      content: "A minor detail.",
      importance: 0.2,
    });

    const tree = buildGroundedKnowledgeTree({
      ...base,
      facts: [...base.facts, minor],
    });

    expect(
      flatten(tree.root).some(
        (node) => node.id === "minor",
      ),
    ).toBe(false);
    expect(
      findNode(
        tree.root,
        "Spanning Tree Protocol",
      ),
    ).toBeDefined();
    expect(
      tree.quality.majorConceptCoverage,
    ).toBe(1);
  });

  it("omits an important concept that has no evidence and reports the quality warning", () => {
    const base = makeGrounding();

    const tree = buildGroundedKnowledgeTree({
      ...base,
      concepts: [
        ...base.concepts,
        makeConcept({
          name: "Ungrounded Major Concept",
          importance: 0.99,
          evidence: false,
        }),
      ],
    });

    expect(
      findNode(
        tree.root,
        "Ungrounded Major Concept",
      ),
    ).toBeUndefined();
    expect(
      tree.quality.omittedUngroundedCount,
    ).toBeGreaterThan(0);
  });

  it("keeps knowledge connected even when its source section is not visible", () => {
    const base = makeGrounding();

    const tree = buildGroundedKnowledgeTree({
      ...base,
      concepts: [
        makeConcept({
          name: "Grounded Orphan Candidate",
          sectionIds: ["hidden-section"],
        }),
      ],
    });

    const node = findNode(
      tree.root,
      "Grounded Orphan Candidate",
    );

    expect(node).toBeDefined();
    expect(tree.quality.orphanCount).toBe(0);
    expect(
      flatten(tree.root).some(
        (item) =>
          item.type === "topic" &&
          item.label ===
            "Other grounded knowledge",
      ),
    ).toBe(true);
  });

  it("prevents contradictory hierarchy statements from producing a cycle", () => {
    const base = makeGrounding();
    const a = makeConcept({
      name: "Parent Concept",
      sectionIds: ["s1"],
    });
    const b = makeConcept({
      name: "Child Concept",
      sectionIds: ["s1"],
    });

    const first = makeFact({
      id: "r1",
      sectionId: "s1",
      content:
        "Child Concept is a type of Parent Concept.",
      type: "relationship",
      importance: 0.95,
    });
    const second = makeFact({
      id: "r2",
      sectionId: "s1",
      content:
        "Parent Concept is a type of Child Concept.",
      type: "relationship",
      importance: 0.95,
    });

    const tree = buildGroundedKnowledgeTree({
      ...base,
      concepts: [a, b],
      facts: [...base.facts, first, second],
      keyTerms: [],
    });

    expect(tree.quality.orphanCount).toBe(0);
    expect(tree.quality.maxDepth).toBeLessThanOrEqual(
      4,
    );
    expect(
      tree.quality.skippedHierarchyCount,
    ).toBeGreaterThanOrEqual(1);
  });

  it("supports Unicode concept labels and source topics", () => {
    const base = makeGrounding();
    const thaiConcept: ImportantConcept = {
      name: "โปรโตคอลต้นไม้ครอบคลุม",
      normalizedName: "โปรโตคอลต้นไม้ครอบคลุม",
      explanation:
        "แนวคิดสำหรับป้องกันลูปในเครือข่าย",
      sourceSectionIds: ["thai"],
      evidence: [{
        id: "thai-evidence",
        sectionId: "thai",
        sectionTitle: "การสวิตช์",
        pageNumber: 1,
        text:
          "โปรโตคอลต้นไม้ครอบคลุมช่วยป้องกันลูปในเครือข่าย",
      }],
      importanceScore: 0.9,
    };

    const tree = buildGroundedKnowledgeTree({
      ...base,
      sourceLanguage: "th",
      facts: [],
      keyTerms: [],
      concepts: [thaiConcept],
      sections: [{
        sectionId: "thai",
        heading: "การสวิตช์",
        status: "covered",
        factIds: [],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      }],
    });

    expect(
      findNode(
        tree.root,
        "โปรโตคอลต้นไม้ครอบคลุม",
      ),
    ).toBeDefined();
    expect(tree.quality.status).toBe("passed");
  });
});

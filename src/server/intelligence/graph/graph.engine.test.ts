import { buildGraph } from "./graph.engine";
import type { EvidenceSpan, ExtractedClaim, KnowledgeCore } from "../types";

const createEvidence = (id: string): EvidenceSpan => ({
  id: `evidence-${id}`,
  sectionId: "section-1",
  sectionTitle: "Introduction",
  text: `Evidence supporting ${id}`,
});

const createClaim = (
  id: string,
  validationStatus: ExtractedClaim["validationStatus"],
  evidence: EvidenceSpan[],
): ExtractedClaim => ({
  id,
  type: "method",
  subject: "The paper",
  predicate: "uses",
  object: `Method ${id}`,
  evidence,
  extractionSource: "symbolic",
  confidence: 0.9,
  validationStatus,
});

const createCore = (overrides: Partial<KnowledgeCore> = {}): KnowledgeCore => ({
  method: null,
  dataset: null,
  accuracy: null,
  problem: null,
  contributions: [],
  keyPoints: [],
  entities: [],
  documentProfile: {
    kind: "research_paper",
    confidence: 1,
    reasons: [],
    expectedFields: [],
  },
  claims: [],
  concepts: [],
  validation: {
    validClaimIds: [],
    rejectedClaimIds: [],
    validConceptIds: [],
    rejectedConceptIds: [],
    issues: [],
    groundedClaimRatio: 0.7,
    numericClaimRatio: 1,
    consistencyScore: 1,
    passed: true,
  },
  fieldStates: {},
  ...overrides,
});

const ontology = {
  resolve: (raw: string) => ({
    concept: {
      id: raw,
      label: raw,
      aliases: [],
    },
    confidence: 1,
    matchType: "unresolved",
    rawInput: raw,
    status: "document_local",
  }),
  getById: () => undefined,
  getRelations: () => [],
  getAncestors: () => [],
} as never;

describe("buildGraph", () => {
  it("uses groundedClaimRatio as the paper node confidence", () => {
    const graph = buildGraph(createCore(), ontology, "test-note");
    const paper = graph.getNode("paper:test-note");

    expect(paper).toBeDefined();
    expect(paper?.type).toBe("paper");
    expect(paper?.properties?.confidence).toBe(0.7);
  });

  it("includes only valid claims that have evidence", () => {
    const core = createCore({
      claims: [
        createClaim("grounded", "valid", [createEvidence("grounded")]),
        createClaim("rejected", "rejected", [createEvidence("rejected")]),
        createClaim("no-evidence", "valid", []),
      ],
    });

    const graph = buildGraph(core, ontology, "test-note");

    expect(graph.getNode("claim:grounded")).toBeDefined();
    expect(graph.getNode("claim:rejected")).toBeUndefined();
    expect(graph.getNode("claim:no-evidence")).toBeUndefined();
  });

  it("adds an inferred concept relation with its supporting evidence", () => {
    const evidence: EvidenceSpan = {
      id: "evidence-relation",
      sectionId: "section-1",
      sectionTitle: "Introduction",
      text: "Neural network is a machine learning method.",
    };

    const core = createCore({
      concepts: [
        {
          id: "neural-network",
          term: "Neural network",
          normalizedTerm: "neural network",
          occurrences: 1,
          sectionIds: ["section-1"],
          evidence: [evidence],
          score: 0.9,
          valid: true,
        },
        {
          id: "machine-learning",
          term: "machine learning",
          normalizedTerm: "machine learning",
          occurrences: 1,
          sectionIds: ["section-1"],
          evidence: [evidence],
          score: 0.9,
          valid: true,
        },
      ],
    });

    const graph = buildGraph(core, ontology, "test-note");

    const relation = graph.edges.find(
      (edge) =>
        edge.from === "concept:local-neural_network" &&
        edge.to === "concept:local-machine_learning" &&
        edge.type === "is_a",
    );

    expect(relation).toBeDefined();
    expect(relation?.evidenceIds).toContain("evidence-relation");
  });
});

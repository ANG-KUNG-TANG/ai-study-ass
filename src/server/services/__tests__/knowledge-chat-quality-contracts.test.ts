import {
  GROUNDING_SCHEMA_VERSION,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  assessChatQualityContract,
} from "@/server/services/chat/chat-quality.service";
import {
  assessKnowledgeQualityContract,
} from "@/server/services/knowledge/knowledge-quality.service";

function grounding(): GroundedKnowledge {
  const evidence = [{
    id: "e-dns",
    sectionId: "s1",
    sectionTitle: "Resolution",
    pageNumber: 1,
    text: "DNS resolves a domain name to an IP address.",
  }];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.7",
    sourceHash: "quality-fixture",
    documentKind: "technical_documentation",
    sourceLanguage: "en",
    facts: [{
      id: "f-dns",
      type: "definition",
      content: "DNS resolves a domain name to an IP address.",
      verbatimRequired: false,
      sourceSectionId: "s1",
      evidence,
      evidenceType: "stated",
      verificationStatus: "supported",
      confidence: 0.99,
      importanceScore: 0.99,
      numericTokens: [],
    }],
    keyTerms: [],
    concepts: [{
      name: "DNS",
      normalizedName: "dns",
      explanation: "DNS resolves a domain name to an IP address.",
      sourceSectionIds: ["s1"],
      evidence,
      importanceScore: 0.99,
    }],
    sections: [{
      sectionId: "s1",
      heading: "Resolution",
      status: "covered",
      factIds: ["f-dns"],
      sourceUnitCount: 1,
      omittedUnitCount: 0,
    }],
    quality: {
      score: 1,
      scoreOutOf10: 10,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: 1,
      warnings: [],
    },
    createdAt: new Date("2026-08-29T00:00:00.000Z"),
  };
}

describe("knowledge and chat quality contracts", () => {
  it("passes a fully evidenced semantic knowledge view", () => {
    const source = grounding();
    const evidence = source.concepts[0]!.evidence;
    const report = assessKnowledgeQualityContract({
      grounding: source,
      graph: {
        nodes: [{
          id: "concept-dns",
          type: "concept",
          label: "DNS",
          properties: { evidence },
        }],
        edges: [],
      },
      graphQuality: {
        status: "passed",
        semanticNodeCount: 1,
        semanticEdgeCount: 0,
        semanticIsolationCount: 0,
        semanticEdgeEvidenceCoverage: 1,
        relationshipFactCoverage: 1,
        duplicateEdgeCount: 0,
        conflictingEdgeCount: 0,
        skippedUnsafeRelationshipCount: 0,
        omittedUngroundedNodeCount: 0,
        warnings: [],
      },
      tree: {
        root: {
          id: "root",
          type: "root",
          label: "Knowledge",
          description: null,
          importance: null,
          sourceSectionIds: [],
          evidenceIds: [],
          graphNodeId: null,
          relationToParent: "root",
          relationEvidenceIds: [],
          children: [{
            id: "concept-dns",
            type: "concept",
            label: "DNS",
            description: "DNS resolves a domain name to an IP address.",
            importance: 0.99,
            sourceSectionIds: ["s1"],
            evidenceIds: ["e-dns"],
            graphNodeId: "concept-dns",
            relationToParent: "topic_group",
            relationEvidenceIds: [],
            children: [],
          }],
        },
        quality: {
          status: "passed",
          majorConceptCoverage: 1,
          orphanCount: 0,
          duplicateAliasCount: 0,
          explicitHierarchyCount: 0,
          skippedHierarchyCount: 0,
          omittedUngroundedCount: 0,
          maxDepth: 2,
          warnings: [],
        },
      },
    });

    expect(report.scoreOutOf10).toBe(10);
    expect(report.passed).toBe(true);
  });

  it("treats an honest document-grounded abstention as a high-quality chat outcome", () => {
    const report = assessChatQualityContract({
      answer: "I couldn't find verified evidence in this document that answers that question. I won't guess beyond the uploaded material.",
      decision: {
        answerability: "NOT_ANSWERABLE",
        confidence: 0.98,
        queryCoverage: 0,
        evidence: [],
        evidenceIds: [],
        supportedPoints: [],
      },
    });

    expect(report.hardGatePassed).toBe(true);
    expect(report.scoreOutOf10).toBeGreaterThanOrEqual(9.5);
    expect(report.passed).toBe(true);
  });

  it("fails chat when an unsupported claim is accepted", () => {
    const report = assessChatQualityContract({
      answer: "The document says DNS encrypts all traffic.",
      decision: {
        answerability: "ANSWERABLE",
        confidence: 0.9,
        queryCoverage: 1,
        evidence: ["DNS resolves a domain name to an IP address."],
        evidenceIds: ["e-dns"],
        supportedPoints: ["DNS resolves a domain name to an IP address."],
      },
      validation: {
        accepted: false,
        issueCodes: ["UNSUPPORTED_CLAIM"],
      },
    });

    expect(report.hardGatePassed).toBe(false);
    expect(report.passed).toBe(false);
  });
});

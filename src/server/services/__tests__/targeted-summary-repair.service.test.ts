import type { GroundedKnowledge } from "@/server/intelligence/grounding";
import { retrieveGroundedEvidence } from "@/server/services/evidence-retriever.service";
import {
  applySummaryRepairPatch,
  buildSummaryRepairPlan,
  isSummaryRepairImprovement,
  validateSummaryRepairPatch,
} from "@/server/services/summary/summary-targeted-repair.service";
import type { SummaryQualityReport } from "@/server/services/summary/summary-quality.service";

function groundingFixture(): GroundedKnowledge {
  return {
    schemaVersion: "2.0",
    pipelineVersion: "intelligence-v2.4",
    sourceHash: "fixture",
    documentKind: "technical_documentation",
    sourceLanguage: "en",
    facts: [
      {
        id: "f1",
        type: "definition",
        content: "MongoDB stores application documents in collections.",
        verbatimRequired: false,
        sourceSectionId: "s1",
        evidence: [{
          id: "e1",
          sectionId: "s1",
          sectionTitle: "Database",
          pageNumber: 1,
          text: "MongoDB stores application documents in collections.",
        }],
        evidenceType: "stated",
        verificationStatus: "supported",
        confidence: 0.98,
        importanceScore: 0.92,
        numericTokens: [],
      },
      {
        id: "f2",
        type: "claim",
        content: "Redis is used as the queue backend for background study jobs.",
        verbatimRequired: false,
        sourceSectionId: "s2",
        evidence: [{
          id: "e2",
          sectionId: "s2",
          sectionTitle: "Queue",
          pageNumber: 2,
          text: "Redis is used as the queue backend for background study jobs.",
        }],
        evidenceType: "stated",
        verificationStatus: "supported",
        confidence: 0.97,
        importanceScore: 0.88,
        numericTokens: [],
      },
      {
        id: "f3",
        type: "result",
        content: "The measured extraction accuracy is 92%.",
        verbatimRequired: true,
        sourceSectionId: "s3",
        evidence: [{
          id: "e3",
          sectionId: "s3",
          sectionTitle: "Results",
          pageNumber: 3,
          text: "The measured extraction accuracy is 92%.",
        }],
        evidenceType: "stated",
        verificationStatus: "supported",
        confidence: 0.99,
        importanceScore: 0.95,
        numericTokens: ["92%"],
      },
    ],
    keyTerms: [],
    concepts: [
      {
        name: "MongoDB",
        normalizedName: "mongodb",
        explanation: "Document database",
        sourceSectionIds: ["s1"],
        evidence: [{
          id: "ce1",
          sectionId: "s1",
          sectionTitle: "Database",
          pageNumber: 1,
          text: "MongoDB stores application documents in collections.",
        }],
        importanceScore: 0.9,
      },
      {
        name: "Redis queue",
        normalizedName: "redis queue",
        explanation: "Background job queue backend",
        sourceSectionIds: ["s2"],
        evidence: [{
          id: "ce2",
          sectionId: "s2",
          sectionTitle: "Queue",
          pageNumber: 2,
          text: "Redis is used as the queue backend for background study jobs.",
        }],
        importanceScore: 0.85,
      },
    ],
    sections: [
      {
        sectionId: "s1",
        heading: "Database",
        pageStart: 1,
        pageEnd: 1,
        status: "covered",
        factIds: ["f1"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s2",
        heading: "Queue",
        pageStart: 2,
        pageEnd: 2,
        status: "covered",
        factIds: ["f2"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
      {
        sectionId: "s3",
        heading: "Results",
        pageStart: 3,
        pageEnd: 3,
        status: "covered",
        factIds: ["f3"],
        sourceUnitCount: 1,
        omittedUnitCount: 0,
      },
    ],
    quality: {
      score: 0.92,
      scoreOutOf10: 9.2,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount: 5,
      warnings: [],
    },
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  };
}

function qualityFixture(overrides: Partial<SummaryQualityReport> = {}): SummaryQualityReport {
  return {
    status: "failed",
    faithful: true,
    coverageSufficient: false,
    issues: [
      {
        code: "LOW_SECTION_COVERAGE",
        severity: "error",
        message: "Missing sections",
      },
      {
        code: "LOW_CONCEPT_COVERAGE",
        severity: "error",
        message: "Missing concepts",
      },
    ],
    metrics: {
      factualUnitCount: 2,
      supportedFactualUnitCount: 2,
      unsupportedFactualUnitCount: 0,
      unsupportedNumericUnitCount: 0,
      majorFactTargetCount: 3,
      majorFactCoveredCount: 2,
      requiredSectionCount: 3,
      representedSectionCount: 1,
      conceptTargetCount: 2,
      conceptCoveredCount: 1,
    },
    ...overrides,
  };
}

describe("targeted summary repair", () => {
  it("retrieves requested gap evidence instead of the whole grounding source", () => {
    const grounding = groundingFixture();
    const result = retrieveGroundedEvidence(grounding, {
      sectionIds: ["s2"],
      conceptNames: ["Redis queue"],
      maxCharacters: 1_500,
      maxFacts: 2,
    });

    expect(result.text).toContain("Redis is used as the queue backend");
    expect(result.sectionIds).toContain("s2");
    expect(result.characterCount).toBeLessThanOrEqual(1_500);
  });

  it("requests AI repair only for a faithful comprehensive summary with failing coverage", () => {
    const plan = buildSummaryRepairPlan({
      grounding: groundingFixture(),
      artifact: {
        summary: "## Overview\n\nMongoDB stores application documents in collections.",
        keyPoints: ["MongoDB stores application documents in collections."],
        importantConcepts: ["MongoDB"],
      },
      quality: qualityFixture(),
      mode: "comprehensive",
    });

    expect(plan.needed).toBe(true);
    expect(plan.evidenceRequest.sectionIds).toContain("s2");
    expect(plan.evidenceRequest.conceptNames).toContain("Redis queue");

    const concisePlan = buildSummaryRepairPlan({
      grounding: groundingFixture(),
      artifact: { summary: "x", keyPoints: [], importantConcepts: [] },
      quality: qualityFixture(),
      mode: "concise",
    });
    expect(concisePlan.needed).toBe(false);
  });

  it("rejects a repair patch that invents a numeric value", () => {
    const patch = validateSummaryRepairPatch(
      {
        overviewAdditions: [],
        keyPoints: ["The measured extraction accuracy is 95%."],
        importantConcepts: [],
      },
      "The measured extraction accuracy is 92%.",
    );

    expect(patch).toBeNull();
  });

  it("merges a grounded patch without replacing the deterministic summary", () => {
    const repaired = applySummaryRepairPatch(
      {
        summary: [
          "# Study Notes",
          "## Overview",
          "MongoDB stores application documents in collections.",
          "## Key Points",
          "- MongoDB stores application documents in collections.",
          "## Main Concepts",
          "- MongoDB",
        ].join("\n\n"),
        keyPoints: ["MongoDB stores application documents in collections."],
        importantConcepts: ["MongoDB"],
        confidence: 0.86,
        status: "ready",
        profile: null,
      },
      {
        overviewAdditions: [],
        keyPoints: ["Redis is used as the queue backend for background study jobs."],
        importantConcepts: ["Redis queue"],
      },
    );

    expect(repaired.summary).toContain("MongoDB stores application documents");
    expect(repaired.summary).toContain("Redis is used as the queue backend");
    expect(repaired.importantConcepts).toContain("Redis queue");
  });

  it("accepts a repair only when grounded coverage improves without faithfulness regression", () => {
    const before = qualityFixture();
    const after = qualityFixture({
      status: "warning",
      coverageSufficient: true,
      issues: [],
      metrics: {
        ...qualityFixture().metrics,
        representedSectionCount: 3,
        conceptCoveredCount: 2,
      },
    });

    expect(isSummaryRepairImprovement(before, after)).toBe(true);
    expect(
      isSummaryRepairImprovement(before, {
        ...after,
        faithful: false,
      }),
    ).toBe(false);
  });
});

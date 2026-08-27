import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  buildQuizSufficiencyPlan,
  minimumAcceptableQuizCount,
  retrieveQuizRepairEvidence,
} from "@/server/services/quiz/quiz-sufficiency.service";

function fact(
  id: string,
  sectionId: string,
  content: string,
  importance: number,
): AtomicFact {
  return {
    id,
    type: "claim",
    content,
    verbatimRequired: false,
    sourceSectionId: sectionId,
    evidence: [{
      id: `e-${id}`,
      sectionId,
      sectionTitle: `Section ${sectionId}`,
      pageNumber: 1,
      text: content,
    }],
    evidenceType: "stated",
    verificationStatus: "supported",
    confidence: 0.96,
    importanceScore: importance,
    numericTokens: [],
  };
}

function grounding(): GroundedKnowledge {
  const facts = [
    fact("f1", "s1", "Alpha routing chooses the shortest verified path.", 0.99),
    fact("f2", "s2", "Beta validation rejects unsupported route advertisements.", 0.95),
    fact("f3", "s3", "Gamma convergence occurs after all routers learn the stable topology.", 0.92),
    fact("f4", "s4", "Delta timers control how frequently routing updates are processed.", 0.89),
    fact("f5", "s5", "Epsilon metrics rank candidate paths before forwarding decisions.", 0.86),
  ];

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: "intelligence-v2.4",
    sourceHash: "source",
    documentKind: "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      {
        name: "Routing Convergence",
        normalizedName: "routing convergence",
        explanation: "The process of reaching a stable routing state.",
        sourceSectionIds: ["s3"],
        evidence: facts[2]!.evidence,
        importanceScore: 0.94,
      },
      {
        name: "Route Validation",
        normalizedName: "route validation",
        explanation: "Validation of routing information.",
        sourceSectionIds: ["s2"],
        evidence: facts[1]!.evidence,
        importanceScore: 0.9,
      },
    ],
    sections: facts.map((item, index) => ({
      sectionId: item.sourceSectionId,
      heading: `Section ${index + 1}`,
      status: "covered" as const,
      factIds: [item.id],
      sourceUnitCount: 1,
      omittedUnitCount: 0,
    })),
    quality: {
      score: 0.94,
      scoreOutOf10: 9.4,
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

describe("quiz sufficiency", () => {
  it("uses the existing ready threshold as minimum acceptable quiz size", () => {
    expect(minimumAcceptableQuizCount(10)).toBe(7);
    expect(minimumAcceptableQuizCount(12)).toBe(9);
    expect(minimumAcceptableQuizCount(2)).toBe(2);
  });

  it("does not spend AI merely to fill a grounded quiz from 8 to 10", () => {
    const plan = buildQuizSufficiencyPlan({
      targetCount: 10,
      acceptedCount: 8,
      qualityValidated: true,
    });

    expect(plan.minimumAcceptableCount).toBe(7);
    expect(plan.targetShortfall).toBe(2);
    expect(plan.needsAI).toBe(false);
    expect(plan.requestedAIAdditions).toBe(0);
  });

  it("requests only enough AI questions to reach grounded sufficiency", () => {
    const plan = buildQuizSufficiencyPlan({
      targetCount: 10,
      acceptedCount: 5,
      qualityValidated: true,
    });

    expect(plan.minimumAcceptableCount).toBe(7);
    expect(plan.requestedAIAdditions).toBe(2);
    expect(plan.needsAI).toBe(true);
  });

  it("preserves exact-target fallback for non-grounded generation", () => {
    const plan = buildQuizSufficiencyPlan({
      targetCount: 10,
      acceptedCount: 8,
      qualityValidated: false,
    });

    expect(plan.requestedAIAdditions).toBe(2);
    expect(plan.needsAI).toBe(true);
  });

  it("targets important evidence not already represented by accepted questions", () => {
    const evidence = retrieveQuizRepairEvidence(
      grounding(),
      [{
        question: "What does Alpha routing do?",
        questionType: "short_answer",
        options: [],
        answer: "Alpha routing chooses the shortest verified path.",
        explanation: "Verified evidence.",
      }],
      2,
    );

    expect(evidence.characterCount).toBeLessThanOrEqual(3_200);
    expect(evidence.factIds).not.toContain("f1");
    expect(evidence.factIds).toEqual(
      expect.arrayContaining(["f2", "f3"]),
    );
    expect(evidence.text).toContain("Beta validation");
  });
});

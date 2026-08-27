import {
  GROUNDING_SCHEMA_VERSION,
  type AtomicFact,
  type GroundedKnowledge,
} from "@/server/intelligence/grounding";
import {
  buildFlashcardSufficiencyPlan,
  minimumAcceptableFlashcardCount,
  retrieveFlashcardRepairEvidence,
} from "@/server/services/flashcard/flashcard-sufficiency.service";

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
    sourceSectionId:
      sectionId,
    evidence: [{
      id: `e-${id}`,
      sectionId,
      sectionTitle:
        `Section ${sectionId}`,
      pageNumber: 1,
      text: content,
    }],
    evidenceType: "stated",
    verificationStatus:
      "supported",
    confidence: 0.96,
    importanceScore:
      importance,
    numericTokens: [],
  };
}

function grounding():
  GroundedKnowledge {
  const facts = [
    fact(
      "f1",
      "s1",
      "Alpha routing chooses the shortest verified path.",
      0.99,
    ),
    fact(
      "f2",
      "s2",
      "Beta validation rejects unsupported route advertisements.",
      0.95,
    ),
    fact(
      "f3",
      "s3",
      "Gamma convergence occurs after all routers learn the stable topology.",
      0.92,
    ),
    fact(
      "f4",
      "s4",
      "Delta timers control how frequently routing updates are processed.",
      0.89,
    ),
    fact(
      "f5",
      "s5",
      "Epsilon metrics rank candidate paths before forwarding decisions.",
      0.86,
    ),
    fact(
      "f6",
      "s6",
      "Zeta warnings identify inconsistent routing information.",
      0.83,
    ),
  ];

  return {
    schemaVersion:
      GROUNDING_SCHEMA_VERSION,
    pipelineVersion:
      "intelligence-v2.4",
    sourceHash: "source",
    documentKind:
      "lecture_notes",
    sourceLanguage: "en",
    facts,
    keyTerms: [],
    concepts: [
      {
        name:
          "Routing Convergence",
        normalizedName:
          "routing convergence",
        explanation:
          "The process of reaching a stable routing state.",
        sourceSectionIds:
          ["s3"],
        evidence:
          facts[2]!.evidence,
        importanceScore: 0.94,
      },
      {
        name:
          "Route Validation",
        normalizedName:
          "route validation",
        explanation:
          "Validation of routing information.",
        sourceSectionIds:
          ["s2"],
        evidence:
          facts[1]!.evidence,
        importanceScore: 0.9,
      },
    ],
    sections:
      facts.map(
        (item, index) => ({
          sectionId:
            item.sourceSectionId,
          heading:
            `Section ${index + 1}`,
          status:
            "covered" as const,
          factIds: [item.id],
          sourceUnitCount: 1,
          omittedUnitCount: 0,
        }),
      ),
    quality: {
      score: 0.94,
      scoreOutOf10: 9.4,
      passed: true,
      supportedFactRatio: 1,
      sectionCoverageRatio: 1,
      numericExactnessRatio: 1,
      qualifiedTermPrecision: 1,
      duplicateFactRatio: 0,
      artifactCount:
        facts.length,
      warnings: [],
    },
    createdAt:
      new Date(
        "2026-08-27T00:00:00.000Z",
      ),
  };
}

describe(
  "flashcard sufficiency",
  () => {
    it(
      "uses the existing ready threshold as the minimum acceptable grounded deck size",
      () => {
        expect(
          minimumAcceptableFlashcardCount(
            15,
          ),
        ).toBe(11);
        expect(
          minimumAcceptableFlashcardCount(
            10,
          ),
        ).toBe(7);
        expect(
          minimumAcceptableFlashcardCount(
            3,
          ),
        ).toBe(3);
      },
    );

    it(
      "does not spend AI merely to fill a grounded deck from 12 to the target of 15",
      () => {
        const plan =
          buildFlashcardSufficiencyPlan({
            targetCount: 15,
            acceptedCount: 12,
            qualityValidated: true,
          });

        expect(
          plan.minimumAcceptableCount,
        ).toBe(11);
        expect(
          plan.targetShortfall,
        ).toBe(3);
        expect(
          plan.needsAI,
        ).toBe(false);
        expect(
          plan.requestedAIAdditions,
        ).toBe(0);
      },
    );

    it(
      "requests only enough AI cards to reach grounded sufficiency",
      () => {
        const plan =
          buildFlashcardSufficiencyPlan({
            targetCount: 15,
            acceptedCount: 8,
            qualityValidated: true,
          });

        expect(
          plan.minimumAcceptableCount,
        ).toBe(11);
        expect(
          plan.requestedAIAdditions,
        ).toBe(3);
        expect(
          plan.needsAI,
        ).toBe(true);
      },
    );

    it(
      "preserves exact-target fallback for non-grounded legacy generation",
      () => {
        const plan =
          buildFlashcardSufficiencyPlan({
            targetCount: 15,
            acceptedCount: 12,
            qualityValidated: false,
          });

        expect(
          plan.requestedAIAdditions,
        ).toBe(3);
        expect(
          plan.needsAI,
        ).toBe(true);
      },
    );

    it(
      "targets important evidence not already represented by accepted cards",
      () => {
        const source =
          grounding();
        const evidence =
          retrieveFlashcardRepairEvidence(
            source,
            [{
              front:
                "What does Alpha routing do?",
              back:
                "Alpha routing chooses the shortest verified path.",
              difficulty:
                "easy",
            }],
            2,
          );

        expect(
          evidence.characterCount,
        ).toBeLessThanOrEqual(
          3_200,
        );
        expect(
          evidence.factIds,
        ).not.toContain(
          "f1",
        );
        expect(
          evidence.factIds,
        ).toEqual(
          expect.arrayContaining([
            "f2",
            "f3",
          ]),
        );
        expect(
          evidence.text,
        ).toContain(
          "Beta validation",
        );
      },
    );
  },
);

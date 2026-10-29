import { describe, expect, it } from "@jest/globals";
import { validateKnowledge } from "./claim_validator";
import type { DocumentProfile, ExtractedClaim, KnowledgeCore } from "../types";

function createClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: "claim-1",
    type: "method",
    subject: "Model",
    predicate: "uses",
    object: "ResNet",
    evidence: [
      {
        id: "evidence-1",
        sectionId: "section-1",
        sectionTitle: "Methodology",
        text: "The model uses ResNet.",
      },
    ],
    extractionSource: "symbolic",
    confidence: 0.9,
    ...overrides,
  };
}

function createCore(claims: ExtractedClaim[]): KnowledgeCore {
  const documentProfile: DocumentProfile = {
    kind: "research_paper",
    confidence: 1,
    reasons: [],
    expectedFields: [],
  };

  return {
    method: null,
    dataset: null,
    accuracy: null,
    problem: null,
    contributions: [],
    keyPoints: [],
    entities: [],
    documentProfile,
    claims,
    concepts: [],
    validation: {
      validClaimIds: [],
      rejectedClaimIds: [],
      validConceptIds: [],
      rejectedConceptIds: [],
      issues: [],
      groundedClaimRatio: 0,
      numericClaimRatio: 1,
      consistencyScore: 1,
      passed: false,
    },
    fieldStates: {},
  };
}

describe("validateKnowledge", () => {
  it("rejects a claim with no evidence", () => {
    const result = validateKnowledge(
      createCore([createClaim({ evidence: [] })]),
    );

    expect(result.claims[0].validationStatus).toBe("rejected");
    expect(result.validation.rejectedClaimIds).toContain("claim-1");
    expect(result.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_evidence",
          claimId: "claim-1",
        }),
      ]),
    );
    expect(result.validation.groundedClaimRatio).toBe(0);
  });

  it("rejects a numeric claim when its value is absent from the evidence", () => {
    const result = validateKnowledge(
      createCore([
        createClaim({
          type: "result",
          object: "95% accuracy",
          metric: "accuracy",
          numericValue: 95,
          evidence: [
            {
              id: "evidence-1",
              sectionId: "section-1",
              sectionTitle: "Results",
              text: "The experiment used 100 samples.",
            },
          ],
        }),
      ]),
    );

    expect(result.claims[0].validationStatus).toBe("rejected");
    expect(result.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_number",
          claimId: "claim-1",
        }),
      ]),
    );
    expect(result.validation.groundedClaimRatio).toBe(0);
  });

  it("counts a valid evidence-supported claim as grounded", () => {
    const result = validateKnowledge(createCore([createClaim()]));

    expect(result.claims[0].validationStatus).toBe("valid");
    expect(result.validation.validClaimIds).toContain("claim-1");
    expect(result.validation.groundedClaimRatio).toBe(1);
  });

  it("counts only valid claims with evidence in the grounding ratio", () => {
    const validClaim = createClaim({
      id: "valid-claim",
    });

    const rejectedWithEvidence = createClaim({
      id: "rejected-with-evidence",
      numericValue: 95,
      evidence: [
        {
          id: "evidence-2",
          sectionId: "section-1",
          sectionTitle: "Results",
          text: "The experiment used 100 samples.",
        },
      ],
    });

    const rejectedWithoutEvidence = createClaim({
      id: "rejected-without-evidence",
      evidence: [],
    });

    const result = validateKnowledge(
      createCore([validClaim, rejectedWithEvidence, rejectedWithoutEvidence]),
    );

    expect(result.validation.validClaimIds).toEqual(["valid-claim"]);
    expect(result.validation.rejectedClaimIds).toEqual(
      expect.arrayContaining([
        "rejected-with-evidence",
        "rejected-without-evidence",
      ]),
    );
    expect(result.validation.groundedClaimRatio).toBeCloseTo(1 / 3);
  });
});

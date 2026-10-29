import { describe, expect, it } from "@jest/globals";
import type { KnowledgeCore, ResolvedConcept } from "../types";
import { detectGaps } from "./gap_detector";

function makeCore(
  kind: KnowledgeCore["documentProfile"]["kind"] = "research_paper",
): KnowledgeCore {
  return {
    method: null,
    dataset: null,
    accuracy: null,
    problem: null,
    contributions: [],
    keyPoints: [],
    entities: [],
    documentProfile: {
      kind,
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
      groundedClaimRatio: 1,
      numericClaimRatio: 1,
      consistencyScore: 1,
      passed: true,
    },
    fieldStates: {},
  };
}

describe("detectGaps", () => {
  it("does not report results missing when results are present", () => {
    const gaps = detectGaps(
      makeCore(),
      [],
      ["abstract", "methodology", "results", "conclusion"],
    );

    expect(gaps.missingSections).not.toContain("results");
  });

  it("reports results missing when only conclusion is present", () => {
    const gaps = detectGaps(
      makeCore(),
      [],
      ["abstract", "methodology", "conclusion"],
    );

    expect(gaps.missingSections).toContain("results");
  });

  it("accepts discussion as results coverage", () => {
    const gaps = detectGaps(
      makeCore(),
      [],
      ["abstract", "methodology", "discussion", "conclusion"],
    );

    expect(gaps.missingSections).not.toContain("results");
  });

  it("accepts experiments as methodology coverage", () => {
    const gaps = detectGaps(
      makeCore(),
      [],
      ["abstract", "experiments", "results", "conclusion"],
    );

    expect(gaps.missingSections).not.toContain("methodology");
  });

  it("does not require research sections for lecture notes", () => {
    const gaps = detectGaps(makeCore("lecture_notes"), [], []);

    expect(gaps.missingSections).toEqual([]);
  });

  it("reports an applicable required field when it is missing", () => {
    const core = makeCore();

    core.documentProfile.expectedFields = [
      {
        field: "method",
        applicable: true,
        required: true,
        reason: "The research paper should describe its methodology.",
      },
    ];

    core.fieldStates = {
      method: "missing",
    };

    const gaps = detectGaps(core, [], []);

    expect(gaps.missingFields).toContain("method");
    expect(gaps.structuralGaps).toContain("Missing required method");
  });

  it("does not report a non-applicable field as missing", () => {
    const core = makeCore();

    core.documentProfile.expectedFields = [
      {
        field: "data_source",
        applicable: false,
        required: true,
        reason: "This document type does not require a data source.",
      },
    ];

    core.fieldStates = {
      data_source: "not_applicable",
    };

    const gaps = detectGaps(core, [], []);

    expect(gaps.missingFields).not.toContain("data_source");
    expect(gaps.notApplicableFields).toContain("data_source");
  });

  it("reduces coverage when a required research section is missing", () => {
    const gaps = detectGaps(
      makeCore(),
      [],
      ["abstract", "methodology", "conclusion"],
    );

    expect(gaps.coverageScore).toBeLessThan(1);
  });

  it("returns full coverage when all expected sections are present", () => {
    const gaps = detectGaps(
      makeCore(),
      [],
      ["abstract", "methodology", "results", "conclusion"],
    );

    expect(gaps.missingSections).toEqual([]);
    expect(gaps.missingFields).toEqual([]);
    expect(gaps.coverageScore).toBe(1);
  });

  it("reports unresolved ontology entities", () => {
    const ontology = [
      {
        matchType: "unknown",
        rawInput: "Quantum widget",
        concept: {
          id: "unknown",
          label: "Quantum widget",
          aliases: [],
          relations: [],
        },
      },
    ] as unknown as ResolvedConcept[];

    const gaps = detectGaps(makeCore("lecture_notes"), ontology, []);

    expect(gaps.unresolvedEntities).toContain("Quantum widget");
  });

  it("reports related concepts that have not been observed", () => {
    const ontology = [
      {
        matchType: "exact",
        rawInput: "Neural network",
        concept: {
          id: "neural-network",
          label: "Neural network",
          aliases: [],
          relations: [
            {
              target: "machine-learning",
            },
          ],
        },
      },
    ] as unknown as ResolvedConcept[];

    const gaps = detectGaps(makeCore("lecture_notes"), ontology, []);

    expect(gaps.domainGaps).toContain("machine-learning");
  });
});

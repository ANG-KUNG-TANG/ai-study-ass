import {
  isSummaryCandidatePreferred,
} from "@/server/services/summary/summary-candidate-arbitration.service";
import type {
  SummaryQualityReport,
} from "@/server/services/summary/summary-quality.service";

function quality(overrides: Partial<SummaryQualityReport> = {}): SummaryQualityReport {
  const report: SummaryQualityReport = {
    status: "warning",
    faithful: true,
    coverageSufficient: true,
    issues: [],
    metrics: {
      factualUnitCount: 32,
      supportedFactualUnitCount: 32,
      unsupportedFactualUnitCount: 0,
      unsupportedNumericUnitCount: 0,
      majorFactTargetCount: 12,
      majorFactCoveredCount: 8,
      requiredSectionCount: 10,
      representedSectionCount: 8,
      conceptTargetCount: 15,
      conceptCoveredCount: 15,
    },
    scoreOutOf10: 8.009,
    contractPassed: false,
    contract: {
      feature: "summary",
      passed: false,
      hardGatePassed: false,
      scoreOutOf10: 8.009,
      targetScore: 9.5,
      dimensions: [],
      hardGates: [
        { code: "TOPIC_SEMANTIC_COHERENCE", message: "", passed: false },
        { code: "LEARNING_POINT_UTILITY", message: "", passed: false },
        { code: "NO_UNSUPPORTED_FACTS", message: "", passed: true },
      ],
      warnings: [],
    },
  };
  return { ...report, ...overrides };
}

describe("summary candidate arbitration", () => {
  it("does not replace a faithful coverage-sufficient summary with a weaker recovery", () => {
    const original = quality();
    const recovery = quality({
      status: "failed",
      coverageSufficient: false,
      scoreOutOf10: 6.83,
      metrics: {
        ...original.metrics,
        majorFactCoveredCount: 4,
        representedSectionCount: 6,
        conceptCoveredCount: 14,
      },
    });

    expect(isSummaryCandidatePreferred(recovery, original)).toBe(false);
    expect(isSummaryCandidatePreferred(original, recovery)).toBe(true);
  });

  it("does not trade semantic hard-gate integrity for broader raw section coverage", () => {
    const clean = quality({
      coverageSufficient: false,
      contract: {
        ...quality().contract,
        hardGatePassed: true,
        hardGates: quality().contract.hardGates.map((gate) => ({ ...gate, passed: true })),
      },
    });
    const structurallyDirty = quality({
      coverageSufficient: true,
      scoreOutOf10: 9.1,
      contract: {
        ...quality().contract,
        hardGatePassed: false,
        hardGates: [
          { code: "SOURCE_STRUCTURE_SEPARATION", message: "", passed: false },
          { code: "TOPIC_EXPLANATION_ALIGNMENT", message: "", passed: false },
          { code: "NO_UNSUPPORTED_FACTS", message: "", passed: true },
        ],
      },
    });

    expect(isSummaryCandidatePreferred(structurallyDirty, clean)).toBe(false);
    expect(isSummaryCandidatePreferred(clean, structurallyDirty)).toBe(true);
  });

  it("prefers a faithful contract-passing recovery over a failed candidate", () => {
    const original = quality({ status: "failed", coverageSufficient: false });
    const recovery = quality({
      status: "passed",
      contractPassed: true,
      coverageSufficient: true,
      scoreOutOf10: 9.7,
      contract: {
        ...original.contract,
        passed: true,
        hardGatePassed: true,
        scoreOutOf10: 9.7,
        hardGates: original.contract.hardGates.map((gate) => ({ ...gate, passed: true })),
      },
    });

    expect(isSummaryCandidatePreferred(recovery, original)).toBe(true);
  });

  it("always prefers faithful evidence over an unfaithful higher numeric score", () => {
    const faithful = quality({ scoreOutOf10: 7.4 });
    const unfaithful = quality({ faithful: false, scoreOutOf10: 9.9 });

    expect(isSummaryCandidatePreferred(unfaithful, faithful)).toBe(false);
    expect(isSummaryCandidatePreferred(faithful, unfaithful)).toBe(true);
  });
});

import type {
  SummaryQualityReport,
} from "@/server/services/summary/summary-quality.service";

export interface SummaryCandidatePreference {
  faithful: number;
  contractPassed: number;
  coverageSufficient: number;
  hardGatePassed: number;
  hardGateRatio: number;
  majorFactCoverage: number;
  sectionCoverage: number;
  conceptCoverage: number;
  scoreOutOf10: number;
}

export function summaryCandidatePreference(
  quality: SummaryQualityReport,
): SummaryCandidatePreference {
  const hardGates = quality.contract.hardGates;
  const passedHardGates = hardGates.filter((gate) => gate.passed).length;
  const ratio = (actual: number, target: number): number =>
    target > 0 ? Math.min(1, actual / target) : 1;

  return {
    faithful: quality.faithful ? 1 : 0,
    contractPassed: quality.contractPassed ? 1 : 0,
    coverageSufficient: quality.coverageSufficient ? 1 : 0,
    hardGatePassed: quality.contract.hardGatePassed ? 1 : 0,
    hardGateRatio: hardGates.length > 0 ? passedHardGates / hardGates.length : 1,
    majorFactCoverage: ratio(
      quality.metrics.majorFactCoveredCount,
      quality.metrics.majorFactTargetCount,
    ),
    sectionCoverage: ratio(
      quality.metrics.representedSectionCount,
      quality.metrics.requiredSectionCount,
    ),
    conceptCoverage: ratio(
      quality.metrics.conceptCoveredCount,
      quality.metrics.conceptTargetCount,
    ),
    scoreOutOf10: quality.scoreOutOf10,
  };
}

export function isSummaryCandidatePreferred(
  candidate: SummaryQualityReport,
  current: SummaryQualityReport,
): boolean {
  const left = summaryCandidatePreference(candidate);
  const right = summaryCandidatePreference(current);
  const keys: Array<keyof SummaryCandidatePreference> = [
    "faithful",
    "contractPassed",
    // A candidate that violates semantic/faithfulness hard gates must not
    // outrank a structurally clean candidate merely because it copied more
    // source sections. Coverage is considered after hard-gate integrity.
    "hardGatePassed",
    "hardGateRatio",
    "coverageSufficient",
    "majorFactCoverage",
    "sectionCoverage",
    "conceptCoverage",
    "scoreOutOf10",
  ];

  for (const key of keys) {
    if (left[key] === right[key]) continue;
    return left[key] > right[key];
  }

  return false;
}

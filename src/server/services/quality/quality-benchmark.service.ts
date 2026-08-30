import type {
  DocumentKind,
} from "@/server/intelligence/types";
import {
  FEATURE_QUALITY_TARGET,
  type FeatureQualityContractReport,
  type StudyFeatureQualityName,
} from "@/server/services/quality/feature-quality.contract";

export interface QualityBenchmarkCase {
  id: string;
  documentKind: DocumentKind;
  reports: Partial<Record<StudyFeatureQualityName, FeatureQualityContractReport>>;
}

export interface QualityBenchmarkFeatureResult {
  feature: StudyFeatureQualityName;
  caseCount: number;
  passingCaseCount: number;
  passRate: number;
  averageScoreOutOf10: number;
  minimumScoreOutOf10: number;
  passed: boolean;
}

export interface QualityBenchmarkResult {
  passed: boolean;
  caseCount: number;
  featureResults: QualityBenchmarkFeatureResult[];
  failures: Array<{
    caseId: string;
    documentKind: DocumentKind;
    feature: StudyFeatureQualityName;
    scoreOutOf10: number;
    failedHardGates: string[];
  }>;
}

const FEATURES: StudyFeatureQualityName[] = [
  "summary",
  "quiz",
  "flashcards",
  "knowledge",
  "chat",
];

export function evaluateQualityBenchmark(
  cases: QualityBenchmarkCase[],
): QualityBenchmarkResult {
  const featureResults = FEATURES.map((feature) => {
    const reports = cases
      .map((item) => item.reports[feature])
      .filter((report): report is FeatureQualityContractReport => Boolean(report));
    const passing = reports.filter((report) => report.passed).length;
    const scores = reports.map((report) => report.scoreOutOf10);

    return {
      feature,
      caseCount: reports.length,
      passingCaseCount: passing,
      passRate: reports.length > 0 ? passing / reports.length : 0,
      averageScoreOutOf10:
        scores.length > 0
          ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : 0,
      minimumScoreOutOf10: scores.length > 0 ? Math.min(...scores) : 0,
      passed:
        reports.length > 0 &&
        passing === reports.length &&
        scores.every((score) => score >= FEATURE_QUALITY_TARGET),
    } satisfies QualityBenchmarkFeatureResult;
  });

  const failures: QualityBenchmarkResult["failures"] = [];
  for (const item of cases) {
    for (const feature of FEATURES) {
      const report = item.reports[feature];
      if (!report || report.passed) continue;
      failures.push({
        caseId: item.id,
        documentKind: item.documentKind,
        feature,
        scoreOutOf10: report.scoreOutOf10,
        failedHardGates: report.hardGates
          .filter((gate) => !gate.passed)
          .map((gate) => gate.code),
      });
    }
  }

  return {
    passed:
      cases.length > 0 &&
      featureResults.every((result) => result.passed),
    caseCount: cases.length,
    featureResults,
    failures,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

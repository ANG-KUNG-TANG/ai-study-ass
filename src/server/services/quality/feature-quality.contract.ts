export const FEATURE_QUALITY_TARGET = 9.5 as const;

export type StudyFeatureQualityName =
  | "summary"
  | "quiz"
  | "flashcards"
  | "knowledge"
  | "chat";

export interface FeatureQualityDimension {
  key: string;
  label: string;
  weight: number;
  ratio: number;
  score: number;
}

export interface FeatureQualityHardGate {
  code: string;
  message: string;
  passed: boolean;
}

export interface FeatureQualityContractReport {
  feature: StudyFeatureQualityName;
  scoreOutOf10: number;
  targetScore: number;
  passed: boolean;
  hardGatePassed: boolean;
  dimensions: FeatureQualityDimension[];
  hardGates: FeatureQualityHardGate[];
  warnings: string[];
}

export interface QualityDimensionInput {
  key: string;
  label: string;
  weight: number;
  ratio: number;
}

export interface QualityHardGateInput {
  code: string;
  message: string;
  passed: boolean;
}

export function buildFeatureQualityReport(input: {
  feature: StudyFeatureQualityName;
  dimensions: QualityDimensionInput[];
  hardGates?: QualityHardGateInput[];
  warnings?: string[];
  targetScore?: number;
}): FeatureQualityContractReport {
  const targetScore = input.targetScore ?? FEATURE_QUALITY_TARGET;
  const totalWeight = input.dimensions.reduce(
    (sum, dimension) => sum + Math.max(0, dimension.weight),
    0,
  );

  if (totalWeight <= 0) {
    throw new Error("Feature quality contract requires at least one positive dimension weight.");
  }

  const dimensions = input.dimensions.map((dimension) => {
    const ratio = clamp01(dimension.ratio);
    return {
      ...dimension,
      ratio: round(ratio),
      score: round(dimension.weight * ratio),
    };
  });
  const weighted = dimensions.reduce(
    (sum, dimension) => sum + dimension.score,
    0,
  );
  const scoreOutOf10 = round((weighted / totalWeight) * 10);
  const hardGates = input.hardGates ?? [];
  const hardGatePassed = hardGates.every((gate) => gate.passed);

  return {
    feature: input.feature,
    scoreOutOf10,
    targetScore,
    passed: hardGatePassed && scoreOutOf10 >= targetScore,
    hardGatePassed,
    dimensions,
    hardGates,
    warnings: input.warnings ?? [],
  };
}

export function isFeatureQualityImprovement(
  before: FeatureQualityContractReport,
  after: FeatureQualityContractReport,
  minimumScoreDelta = 0.05,
): boolean {
  if (!after.hardGatePassed) return false;
  if (after.passed && !before.passed) return true;
  if (before.passed && !after.passed) return false;
  return after.scoreOutOf10 >= before.scoreOutOf10 + minimumScoreDelta;
}

export function qualityRatio(
  numerator: number,
  denominator: number,
  emptyValue = 1,
): number {
  if (denominator <= 0) return clamp01(emptyValue);
  return clamp01(numerator / denominator);
}

export function qualityLogContext(
  report: FeatureQualityContractReport,
): Record<string, unknown> {
  return {
    feature: report.feature,
    qualityScoreOutOf10: report.scoreOutOf10,
    qualityTarget: report.targetScore,
    qualityPassed: report.passed,
    hardGatePassed: report.hardGatePassed,
    failedHardGates: report.hardGates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.code),
    qualityDimensions: Object.fromEntries(
      report.dimensions.map((dimension) => [
        dimension.key,
        {
          ratio: dimension.ratio,
          score: dimension.score,
          weight: dimension.weight,
        },
      ]),
    ),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

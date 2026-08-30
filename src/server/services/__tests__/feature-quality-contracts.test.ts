import {
  buildFeatureQualityReport,
  FEATURE_QUALITY_TARGET,
  type StudyFeatureQualityName,
} from "@/server/services/quality/feature-quality.contract";
import {
  evaluateQualityBenchmark,
} from "@/server/services/quality/quality-benchmark.service";

function perfectReport(feature: StudyFeatureQualityName) {
  return buildFeatureQualityReport({
    feature,
    dimensions: [
      { key: "correctness", label: "Correctness", weight: 7, ratio: 1 },
      { key: "usefulness", label: "Usefulness", weight: 3, ratio: 1 },
    ],
    hardGates: [
      { code: "SAFE", message: "Hard correctness gate", passed: true },
    ],
  });
}

describe("feature-specific quality contracts", () => {
  it("uses 9.5/10 as the release-quality target", () => {
    expect(FEATURE_QUALITY_TARGET).toBe(9.5);
  });

  it("fails a high numerical score when a hard correctness gate fails", () => {
    const report = buildFeatureQualityReport({
      feature: "summary",
      dimensions: [
        { key: "grounding", label: "Grounding", weight: 10, ratio: 1 },
      ],
      hardGates: [
        {
          code: "UNSUPPORTED_FACT",
          message: "No unsupported facts are allowed.",
          passed: false,
        },
      ],
    });

    expect(report.scoreOutOf10).toBe(10);
    expect(report.hardGatePassed).toBe(false);
    expect(report.passed).toBe(false);
  });

  it("requires the weighted score itself to reach the target", () => {
    const report = buildFeatureQualityReport({
      feature: "quiz",
      dimensions: [
        { key: "correctness", label: "Correctness", weight: 10, ratio: 0.94 },
      ],
      hardGates: [
        { code: "VALID", message: "Valid quiz", passed: true },
      ],
    });

    expect(report.scoreOutOf10).toBe(9.4);
    expect(report.hardGatePassed).toBe(true);
    expect(report.passed).toBe(false);
  });

  it("passes a cross-document benchmark only when every feature report passes", () => {
    const features: StudyFeatureQualityName[] = [
      "summary",
      "quiz",
      "flashcards",
      "knowledge",
      "chat",
    ];
    const reports = Object.fromEntries(
      features.map((feature) => [feature, perfectReport(feature)]),
    ) as Record<StudyFeatureQualityName, ReturnType<typeof perfectReport>>;

    const benchmark = evaluateQualityBenchmark([
      {
        id: "lecture-case",
        documentKind: "lecture_notes",
        reports,
      },
      {
        id: "research-case",
        documentKind: "research_paper",
        reports,
      },
    ]);

    expect(benchmark.passed).toBe(true);
    expect(benchmark.featureResults).toHaveLength(5);
    expect(benchmark.featureResults.every((item) => item.minimumScoreOutOf10 >= 9.5)).toBe(true);
  });

  it("reports the exact case, feature, and hard-gate failure", () => {
    const badChat = buildFeatureQualityReport({
      feature: "chat",
      dimensions: [
        { key: "grounding", label: "Grounding", weight: 10, ratio: 1 },
      ],
      hardGates: [
        { code: "NO_GUESSING", message: "No guessing", passed: false },
      ],
    });

    const benchmark = evaluateQualityBenchmark([
      {
        id: "technical-doc",
        documentKind: "technical_documentation",
        reports: {
          summary: perfectReport("summary"),
          quiz: perfectReport("quiz"),
          flashcards: perfectReport("flashcards"),
          knowledge: perfectReport("knowledge"),
          chat: badChat,
        },
      },
    ]);

    expect(benchmark.passed).toBe(false);
    expect(benchmark.failures).toEqual([
      expect.objectContaining({
        caseId: "technical-doc",
        feature: "chat",
        failedHardGates: ["NO_GUESSING"],
      }),
    ]);
  });
});

import type {
  AtomicFact,
  GroundedKnowledge,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import type {
  SemanticEvidenceMap,
  SemanticEvidenceUnit,
} from "@/server/intelligence/semantic-evidence";
import {
  buildSemanticEvidenceMap,
  isStructuralSemanticHeading,
  semanticEvidenceExplanationFit,
  semanticEvidencePointFit,
  semanticTopicTextAlignment,
} from "@/server/intelligence/semantic-evidence";
import type { SummaryMode } from "@/types/summary";
import {
  isActionableSummaryWarningFact,
  isActionableSummaryWarningText,
  selectSummaryConcepts,
  selectSummaryKeyTerms,
  selectSummarySections,
} from "@/server/services/summary/summary-learning-structure.service";
import {
  isSummaryTopicHeadingEligible,
  isSummaryTopicPointUseful,
  summaryTopicTextAlignment,
} from "@/server/services/summary/summary-topic-learning.service";
import {
  buildFeatureQualityReport,
  qualityRatio,
  type FeatureQualityContractReport,
} from "@/server/services/quality/feature-quality.contract";
import {
  buildLearningEvidenceProfile,
  isCorrectionOrWarningText,
} from "@/server/services/quality/learning-evidence.service";

export type SummaryQualityStatus = "passed" | "warning" | "failed";
export type SummaryQualitySeverity = "warning" | "error";

export type SummaryQualityIssueCode =
  | "UNSUPPORTED_FACTUAL_CONTENT"
  | "UNSUPPORTED_NUMERIC_CONTENT"
  | "LOW_MAJOR_FACT_COVERAGE"
  | "LOW_SECTION_COVERAGE"
  | "LOW_CONCEPT_COVERAGE";

export interface SummaryQualityIssue {
  code: SummaryQualityIssueCode;
  severity: SummaryQualitySeverity;
  message: string;
}

export interface SummaryQualityMetrics {
  factualUnitCount: number;
  supportedFactualUnitCount: number;
  unsupportedFactualUnitCount: number;
  unsupportedNumericUnitCount: number;
  majorFactTargetCount: number;
  majorFactCoveredCount: number;
  requiredSectionCount: number;
  representedSectionCount: number;
  conceptTargetCount: number;
  conceptCoveredCount: number;
}

export interface SummaryQualityReport {
  status: SummaryQualityStatus;
  faithful: boolean;
  coverageSufficient: boolean;
  issues: SummaryQualityIssue[];
  metrics: SummaryQualityMetrics;
  scoreOutOf10: number;
  contractPassed: boolean;
  contract: FeatureQualityContractReport;
  diagnostics?: {
    unsupportedFactualUnits: string[];
    unsupportedNumericUnits: string[];
  };
}

export interface SummaryArtifactForValidation {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
}

interface SupportSource {
  text: string;
  numericTokens: Set<string>;
}

interface ModePolicy {
  sectionLimit: number;
  majorFactLimit: number;
  conceptLimit: number;
  minimumMajorFactCoverage: number;
  minimumSectionCoverage: number;
  minimumConceptCoverage: number;
}

const MODE_POLICIES: Record<SummaryMode, ModePolicy> = {
  concise: {
    sectionLimit: 5,
    majorFactLimit: 6,
    conceptLimit: 8,
    minimumMajorFactCoverage: 0.60,
    minimumSectionCoverage: 0.75,
    minimumConceptCoverage: 0.75,
  },
  comprehensive: {
    sectionLimit: 10,
    majorFactLimit: 12,
    conceptLimit: 16,
    minimumMajorFactCoverage: 0.75,
    minimumSectionCoverage: 0.80,
    minimumConceptCoverage: 0.80,
  },
  exam: {
    sectionLimit: 8,
    majorFactLimit: 10,
    conceptLimit: 12,
    minimumMajorFactCoverage: 0.65,
    minimumSectionCoverage: 0.75,
    minimumConceptCoverage: 0.75,
  },
};

const TOPIC_COUNT_RANGES: Record<SummaryMode, { min: number; max: number }> = {
  concise: { min: 3, max: 5 },
  comprehensive: { min: 6, max: 10 },
  exam: { min: 5, max: 8 },
};

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
  "for", "from", "has", "have", "in", "into", "is", "it", "of", "on",
  "or", "that", "the", "their", "these", "this", "those", "to", "was",
  "were", "will", "with",
]);

const EXAM_FACT_TYPES = new Set<AtomicFact["type"]>([
  "definition",
  "objective",
  "rule",
  "condition",
  "formula",
  "number",
  "result",
  "relationship",
  "warning",
  "common_mistake",
]);

const GENERIC_NON_FACT_PATTERNS = [
  /^these notes (?:organise|organize) the verified knowledge extracted from\b/i,
  /^generated working title based on the document content\b/i,
];

export function assessSummaryQuality(input: {
  artifact: SummaryArtifactForValidation;
  grounding: GroundedKnowledge;
  mode: SummaryMode;
}): SummaryQualityReport {
  const { artifact, grounding, mode } = input;
  const policy = MODE_POLICIES[mode];
  const learningProfile = buildLearningEvidenceProfile(grounding);
  const semanticMap = buildSemanticEvidenceMap({
    sections: learningProfile.sections,
    facts: learningProfile.facts,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    documentTitle: extractSummaryTitle(artifact.summary) ?? undefined,
  });

  const allSupportedFacts = grounding.facts.filter(
    (fact) =>
      fact.verificationStatus === "supported" &&
      fact.evidence.length > 0 &&
      !learningProfile.suppressedFactIds.has(fact.id),
  );
  const sourceFactsById = new Map(
    allSupportedFacts.map((fact) => [fact.id, fact]),
  );
  const learningSections = selectSummarySections(
    grounding.sections,
    sourceFactsById,
  );
  const learningFactIds = new Set(
    learningSections.flatMap((section) => section.factIds),
  );
  const learningSupportedFacts = allSupportedFacts.filter((fact) =>
    learningFactIds.has(fact.id),
  );
  const learningConcepts = selectSummaryConcepts(
    learningProfile.concepts,
    policy.conceptLimit,
  );
  const learningKeyTerms = selectSummaryKeyTerms(
    learningProfile.keyTerms,
    16,
  );
  // Faithfulness and learning eligibility are different domains. A fact can
  // be valid grounded evidence even when its source section is not suitable
  // as a learner topic (for example Abstract results, warnings, figure-linked
  // results, or other structural sections). Validate factual support against
  // every supported grounded fact, while coverage/topic scoring continues to
  // use only the learning-eligible subset below.
  const supportSources = buildSupportSources(
    allSupportedFacts,
    learningKeyTerms,
    learningConcepts,
  );
  const factualUnits = extractFactualUnits(artifact);

  const supportedUnits: string[] = [];
  const unsupportedUnits: string[] = [];
  const unsupportedNumericUnits: string[] = [];

  for (const unit of factualUnits) {
    if (isGenericNonFact(unit)) continue;

    const support = bestSupport(unit, supportSources);
    if (support.supported) {
      supportedUnits.push(unit);
    } else {
      unsupportedUnits.push(unit);
      if (extractNumericTokens(unit).size > 0) {
        unsupportedNumericUnits.push(unit);
      }
    }
  }

  const majorFacts = selectMajorFacts(
    learningSupportedFacts,
    mode,
    policy.majorFactLimit,
  );
  const majorFactCoveredCount = majorFacts.filter((fact) =>
    factIsRepresented(fact, artifact.summary, factualUnits)
  ).length;

  const requiredSections = selectRequiredSections(
    learningSections,
    learningSupportedFacts,
    mode,
    policy.sectionLimit,
  );
  const representedSectionCount = requiredSections.filter((section) =>
    sectionIsRepresented(section, artifact.summary, learningSupportedFacts, factualUnits)
  ).length;

  const targetConcepts = learningConcepts.slice(0, policy.conceptLimit);
  const representedConcepts = new Set(
    artifact.importantConcepts.map((concept) => normalise(concept)),
  );
  const normalisedSummary = normalise(artifact.summary);
  const conceptCoveredCount = targetConcepts.filter((concept) => {
    const name = normalise(concept.name);
    return Boolean(
      name &&
      (representedConcepts.has(name) || normalisedSummary.includes(name))
    );
  }).length;

  const factualUnitCount = supportedUnits.length + unsupportedUnits.length;
  const unsupportedRatio = ratio(unsupportedUnits.length, factualUnitCount, 0);
  const majorFactCoverage = ratio(
    majorFactCoveredCount,
    majorFacts.length,
    1,
  );
  const sectionCoverage = ratio(
    representedSectionCount,
    requiredSections.length,
    1,
  );
  const conceptCoverage = ratio(
    conceptCoveredCount,
    targetConcepts.length,
    1,
  );

  const issues: SummaryQualityIssue[] = [];

  if (unsupportedNumericUnits.length > 0) {
    issues.push({
      code: "UNSUPPORTED_NUMERIC_CONTENT",
      severity: "error",
      message:
        "The summary contains numeric content that cannot be tied to grounded source evidence.",
    });
  }

  const strictSemanticSafety = /<!--\s*intelligence-engine:v3\.(?:0|1|2);/iu.test(artifact.summary);
  if (strictSemanticSafety && unsupportedUnits.length > 0) {
    issues.push({
      code: "UNSUPPORTED_FACTUAL_CONTENT",
      severity: "error",
      message:
        "Semantic-evidence summaries require every factual unit to resolve to grounded source evidence.",
    });
  } else if (unsupportedRatio > 0.25) {
    issues.push({
      code: "UNSUPPORTED_FACTUAL_CONTENT",
      severity: "error",
      message:
        "Too much factual summary content cannot be tied to supported source evidence.",
    });
  } else if (unsupportedRatio > 0.08) {
    issues.push({
      code: "UNSUPPORTED_FACTUAL_CONTENT",
      severity: "warning",
      message:
        "Some factual summary content could not be tied confidently to supported source evidence.",
    });
  }

  addCoverageIssue(
    issues,
    "LOW_MAJOR_FACT_COVERAGE",
    majorFacts.length,
    majorFactCoverage,
    policy.minimumMajorFactCoverage,
    "high-importance grounded facts",
  );
  addCoverageIssue(
    issues,
    "LOW_SECTION_COVERAGE",
    requiredSections.length,
    sectionCoverage,
    policy.minimumSectionCoverage,
    "source sections",
  );
  addCoverageIssue(
    issues,
    "LOW_CONCEPT_COVERAGE",
    targetConcepts.length,
    conceptCoverage,
    policy.minimumConceptCoverage,
    "important grounded concepts",
  );

  const hasError = issues.some((issue) => issue.severity === "error");
  const status: SummaryQualityStatus = hasError
    ? "failed"
    : issues.length > 0
      ? "warning"
      : "passed";

  const faithfulnessCodes: SummaryQualityIssueCode[] = [
    "UNSUPPORTED_FACTUAL_CONTENT",
    "UNSUPPORTED_NUMERIC_CONTENT",
  ];
  const coverageCodes: SummaryQualityIssueCode[] = [
    "LOW_MAJOR_FACT_COVERAGE",
    "LOW_SECTION_COVERAGE",
    "LOW_CONCEPT_COVERAGE",
  ];

  const factualGrounding = qualityRatio(
    supportedUnits.length,
    factualUnitCount,
    1,
  );
  const conceptPrecision = qualityRatio(
    artifact.importantConcepts.filter((concept) => {
      const key = normalise(concept);
      return targetConcepts.some((target) => normalise(target.name) === key);
    }).length,
    artifact.importantConcepts.length,
    1,
  );
  const sectionHeadingById = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );
  const warningTargets = learningProfile.warningFacts.filter((fact) =>
    isActionableSummaryWarningFact(
      fact,
      sectionHeadingById.get(fact.sourceSectionId) ?? "",
    ),
  );
  const warningCoverage = qualityRatio(
    warningTargets.filter((fact) =>
      factIsRepresented(fact, artifact.summary, factualUnits),
    ).length,
    warningTargets.length,
    1,
  );
  const duplicateRatio = duplicateTextRatio(factualUnits);
  const keyPointSupported = artifact.keyPoints.filter((point) =>
    bestSupport(point, supportSources).supported,
  ).length;
  const keyPointQuality = qualityRatio(
    keyPointSupported,
    artifact.keyPoints.length,
    1,
  );
  const readability = summaryReadabilityRatio(artifact.summary);
  const modeQuality = Math.min(
    majorFactCoverage,
    sectionCoverage,
    conceptCoverage,
  );
  const qualifiedFactLeak = [...learningProfile.suppressedFactIds]
    .map((id) => grounding.facts.find((fact) => fact.id === id))
    .filter((fact): fact is AtomicFact => Boolean(fact))
    .some((fact) =>
      factualUnits.some((unit) =>
        !isCorrectionOrWarningText(unit) &&
        bestSupport(unit, [factSupportSource(fact)]).supported,
      ),
    );
  const publishedTopicBlocks = extractStudyTopicBlocks(artifact.summary);
  const parsedTopics = publishedTopicBlocks.map(parseQualityTopicBlock);
  const topicHeadingQuality = qualityRatio(
    parsedTopics.filter((topic) => isSummaryTopicHeadingEligible(topic.heading)).length,
    parsedTopics.length,
    1,
  );
  const topicExplanationScores = parsedTopics.map((topic) =>
    topicExplanationSemanticScore(topic, semanticMap),
  );
  const topicExplanationQuality = averageQuality(
    topicExplanationScores,
    1,
  );
  const topicExplanationPassRatio = qualityRatio(
    topicExplanationScores.filter((score) => score >= 0.58).length,
    topicExplanationScores.length,
    1,
  );
  const topicPoints = parsedTopics.flatMap((topic) =>
    topic.keyPoints.map((point) => ({ topic, point })),
  );
  const topicPointUtility = qualityRatio(
    topicPoints.filter(({ point }) => isSummaryTopicPointUseful(point, { allowProcedure: true })).length,
    topicPoints.length,
    1,
  );
  const topicPointAlignment = averageQuality(
    topicPoints.map(({ topic, point }) =>
      topicPointSemanticScore(topic, point, semanticMap),
    ),
    1,
  );
  const coherentTopicRatio = qualityRatio(
    parsedTopics.filter((topic) => topicIsCoherent(topic)).length,
    parsedTopics.length,
    1,
  );
  const warningItems = [
    ...extractSectionBullets(artifact.summary, "Warnings / Common Mistakes"),
    ...extractSectionBullets(artifact.summary, "Important Warnings and Notes"),
  ];
  const warningPrecision = qualityRatio(
    warningItems.filter(isActionableSummaryWarningText).length,
    warningItems.length,
    1,
  );
  const globalKeyPointItems = extractSectionBullets(artifact.summary, "Key Points");
  const legacyTakeawayItems = extractSectionBullets(artifact.summary, "Key Takeaways");
  const globalLearningPointItems = globalKeyPointItems.length > 0
    ? globalKeyPointItems
    : legacyTakeawayItems;
  const globalLearningPointUtility = qualityRatio(
    globalLearningPointItems.filter((item) => isSummaryTopicPointUseful(item)).length,
    globalLearningPointItems.length,
    1,
  );
  const publishedSectionHeadings = extractSectionNoteHeadings(artifact.summary);
  const targetSectionKeys = new Set(requiredSections.map((section) => normalise(section.heading)));
  const sectionPrecision = publishedTopicBlocks.length > 0
    ? qualityRatio(
        publishedTopicBlocks.filter((topic) =>
          extractFactualUnits({
            summary: topic.body,
            keyPoints: [],
            importantConcepts: [],
          }).some((unit) => bestSupport(unit, supportSources).supported),
        ).length,
        publishedTopicBlocks.length,
        1,
      )
    : qualityRatio(
        publishedSectionHeadings.filter((heading) => targetSectionKeys.has(normalise(heading))).length,
        publishedSectionHeadings.length,
        1,
      );
  const topicRange = TOPIC_COUNT_RANGES[mode];
  const legacyTopicContractRequired = /<!--\s*intelligence-engine:(?:v2\.(?:12|13|14)|v3\.0);/iu.test(artifact.summary);
  const learnerOutputContractRequired = /<!--\s*intelligence-engine:v3\.(?:1|2);/iu.test(artifact.summary);
  const topicContractRequired = legacyTopicContractRequired || learnerOutputContractRequired;
  const semanticEvidenceContractRequired = /<!--\s*intelligence-engine:v3\.(?:0|1|2);/iu.test(artifact.summary);
  const detailedTopicTargetSectionCount = requiredSections.filter((section) =>
    section.factIds.some((id) => {
      const fact = sourceFactsById.get(id);
      return Boolean(
        fact &&
        !["procedure_step", "warning", "common_mistake", "limitation", "example", "number", "formula"].includes(fact.type)
      );
    })
  ).length;
  const minimumTopicCount = learnerOutputContractRequired
    ? Math.min(
        mode === "concise" ? 2 : 3,
        detailedTopicTargetSectionCount,
      )
    : Math.min(
        topicRange.min,
        Math.max(1, requiredSections.length),
      );
  const topicCountQuality = publishedTopicBlocks.length === 0
    ? (topicContractRequired && minimumTopicCount > 0 ? 0 : 1)
    : publishedTopicBlocks.length > topicRange.max
      ? topicRange.max / publishedTopicBlocks.length
      : minimumTopicCount === 0
        ? 1
        : Math.min(1, publishedTopicBlocks.length / minimumTopicCount);
  const hasLegacyTopicFirstSections = /^(?:##\s+(?:Key Points|Main Concepts|Section Notes))\s*$/gimu.test(artifact.summary);
  const hasOldSummaryLayoutSections = /^(?:##\s+(?:Study Topics|Main Concepts|Section Notes|Key Takeaways))\s*$/gimu.test(artifact.summary);
  const hasLearnerCoreSections = [
    "Overview",
    "Key Points",
    "Key Concepts",
    "Key Terms",
    "Detailed Study Notes",
  ].every((heading) => hasSectionHeading(artifact.summary, heading));
  const topicStructurePassed = !topicContractRequired || (
    publishedTopicBlocks.length >= minimumTopicCount &&
    publishedTopicBlocks.length <= topicRange.max &&
    (!legacyTopicContractRequired || !hasLegacyTopicFirstSections) &&
    (!learnerOutputContractRequired || (hasLearnerCoreSections && !hasOldSummaryLayoutSections))
  );
  const topicSemanticPassed = !topicContractRequired || (
    topicHeadingQuality >= 0.95 &&
    topicExplanationQuality >= 0.82 &&
    coherentTopicRatio >= 0.82
  );
  const learningPointQuality = Math.min(
    keyPointQuality,
    topicPointUtility,
    topicPointAlignment,
    globalLearningPointUtility,
  );
  const warningPrecisionPassed = warningItems.length === 0 || warningPrecision >= 0.8;
  const summaryTitle = extractSummaryTitle(artifact.summary);
  const sourceStructureSeparationPassed = !semanticEvidenceContractRequired || parsedTopics.every((topic) =>
    !isStructuralSemanticHeading(topic.heading) &&
    (!summaryTitle || normalise(topic.heading) !== normalise(summaryTitle)),
  );
  const topicExplanationAlignmentPassed = !semanticEvidenceContractRequired || (
    topicExplanationPassRatio >= 0.95 &&
    topicExplanationQuality >= 0.72
  );
  const frameworkIntegrity = frameworkIntegrityQuality(parsedTopics, semanticMap);

  const contract = buildFeatureQualityReport({
    feature: "summary",
    dimensions: [
      { key: "grounding", label: "Factual grounding", weight: 2.0, ratio: factualGrounding },
      { key: "conceptCoverage", label: "Important concept coverage", weight: 1.5, ratio: conceptCoverage },
      { key: "learningStructure", label: "Learning structure", weight: 1.5, ratio: Math.min(sectionCoverage, sectionPrecision, topicCountQuality, coherentTopicRatio) },
      { key: "topicExplanationAlignment", label: "Topic-explanation alignment", weight: 1.5, ratio: topicExplanationQuality },
      { key: "keyPointQuality", label: "Key-point quality", weight: 1.0, ratio: learningPointQuality },
      { key: "frameworkIntegrity", label: "Framework integrity", weight: 0.75, ratio: frameworkIntegrity },
      { key: "conceptPrecision", label: "Concept precision", weight: 1.0, ratio: conceptPrecision },
      { key: "sectionRelevance", label: "Section relevance", weight: 1.0, ratio: Math.min(sectionPrecision, topicHeadingQuality, topicPointAlignment) },
      { key: "correctionHandling", label: "Warning/correction handling", weight: 0.75, ratio: Math.min(warningCoverage, warningPrecision) },
      { key: "redundancyControl", label: "Redundancy control", weight: 0.5, ratio: 1 - duplicateRatio },
      { key: "modeQuality", label: "Mode quality", weight: 0.5, ratio: modeQuality },
      { key: "readability", label: "Readability", weight: 0.25, ratio: readability },
    ],
    hardGates: [
      {
        code: "TOPIC_FIRST_STRUCTURE",
        message: "Summary structure must follow its versioned learner-output contract while keeping detailed topics within the mode-specific topic budget.",
        passed: topicStructurePassed,
      },
      {
        code: "TOPIC_SEMANTIC_COHERENCE",
        message: "Every published topic must have a meaningful heading, an explanation about that topic, and locally relevant key points.",
        passed: topicSemanticPassed,
      },
      {
        code: "TOPIC_EXPLANATION_ALIGNMENT",
        message: "An important grounded fact may explain a topic only when its semantic evidence role and source evidence actually align with that topic; importance alone is never sufficient.",
        passed: topicExplanationAlignmentPassed,
      },
      {
        code: "SOURCE_STRUCTURE_SEPARATION",
        message: "Document metadata and structural labels such as titles, Abstract, Introduction, References, exercises, and chapter scaffolding must not become learner topics.",
        passed: sourceStructureSeparationPassed,
      },
      {
        code: "FRAMEWORK_INTEGRITY",
        message: "When a detected framework is published as a topic, its supported components must remain grouped under that framework instead of being fragmented or silently dropped.",
        passed: !semanticEvidenceContractRequired || frameworkIntegrity >= 0.8,
      },
      {
        code: "LEARNING_POINT_UTILITY",
        message: "Global key points and detailed-topic points must be standalone learning statements rather than prompts, narrative transitions, or exercise fragments.",
        passed: !topicContractRequired || (
          topicPointUtility >= 0.85 &&
          topicPointAlignment >= 0.78 &&
          globalLearningPointUtility >= 0.8
        ),
      },
      {
        code: "WARNING_PRECISION",
        message: "The warnings section may contain only actionable warnings, corrections, limitations, or genuine common mistakes.",
        passed: warningPrecisionPassed,
      },
      {
        code: "NO_UNSUPPORTED_FACTS",
        message: "Every factual summary unit must be supported by grounded evidence.",
        passed: unsupportedUnits.length === 0,
      },
      {
        code: "NUMERIC_EXACTNESS",
        message: "Every numeric statement must preserve grounded source values.",
        passed: unsupportedNumericUnits.length === 0,
      },
      {
        code: "CORRECTION_PRECEDENCE",
        message: "A raw fact qualified or corrected by the source must not be presented as the current rule.",
        passed: !qualifiedFactLeak,
      },
    ],
  });

  return {
    status,
    scoreOutOf10: contract.scoreOutOf10,
    contractPassed: contract.passed,
    contract,
    faithful: !issues.some(
      (issue) =>
        issue.severity === "error" &&
        faithfulnessCodes.includes(issue.code),
    ),
    coverageSufficient: !issues.some(
      (issue) =>
        issue.severity === "error" &&
        coverageCodes.includes(issue.code),
    ),
    issues,
    diagnostics: {
      unsupportedFactualUnits: unsupportedUnits.slice(0, 8),
      unsupportedNumericUnits: unsupportedNumericUnits.slice(0, 8),
    },
    metrics: {
      factualUnitCount,
      supportedFactualUnitCount: supportedUnits.length,
      unsupportedFactualUnitCount: unsupportedUnits.length,
      unsupportedNumericUnitCount: unsupportedNumericUnits.length,
      majorFactTargetCount: majorFacts.length,
      majorFactCoveredCount,
      requiredSectionCount: requiredSections.length,
      representedSectionCount,
      conceptTargetCount: targetConcepts.length,
      conceptCoveredCount,
    },
  };
}

export function summaryQualityWarnings(
  report: SummaryQualityReport,
): string[] {
  return report.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);
}

export function summaryQualityLogContext(
  report: SummaryQualityReport,
): Record<string, unknown> {
  return {
    status: report.status,
    faithful: report.faithful,
    coverageSufficient: report.coverageSufficient,
    issueCodes: report.issues.map((issue) => issue.code),
    metrics: report.metrics,
    scoreOutOf10: report.scoreOutOf10,
    contractPassed: report.contractPassed,
    failedHardGates: report.contract.hardGates
      .filter((gate) => !gate.passed)
      .map((gate) => gate.code),
    unsupportedFactualUnits:
      report.diagnostics?.unsupportedFactualUnits ?? [],
    unsupportedNumericUnits:
      report.diagnostics?.unsupportedNumericUnits ?? [],
  };
}

function addCoverageIssue(
  issues: SummaryQualityIssue[],
  code: SummaryQualityIssueCode,
  targetCount: number,
  actualRatio: number,
  minimumRatio: number,
  subject: string,
): void {
  if (targetCount < 2) return;

  if (actualRatio < minimumRatio * 0.65) {
    issues.push({
      code,
      severity: "error",
      message: `The summary omits too many ${subject} for the selected summary mode.`,
    });
  } else if (actualRatio < minimumRatio) {
    issues.push({
      code,
      severity: "warning",
      message: `The summary covers fewer ${subject} than expected for the selected summary mode.`,
    });
  }
}

function buildSupportSources(
  supportedFacts: AtomicFact[],
  keyTerms: GroundedKnowledge["keyTerms"],
  concepts: GroundedKnowledge["concepts"],
): SupportSource[] {
  const sources: SupportSource[] = [];

  for (const fact of supportedFacts) {
    addSupportSource(
      sources,
      [fact.content, ...fact.evidence.map((item) => item.text)].join(" "),
    );
  }

  for (const term of keyTerms) {
    addSupportSource(
      sources,
      [
        term.term,
        term.definition,
        ...term.evidence.map((item) => item.text),
      ].join(" "),
    );
  }

  for (const concept of concepts) {
    addSupportSource(
      sources,
      [
        concept.name,
        concept.explanation ?? "",
        ...concept.evidence.map((item) => item.text),
      ].join(" "),
    );
  }

  return sources;
}

function addSupportSource(
  sources: SupportSource[],
  text: string,
): void {
  const cleaned = stripPresentation(text);
  if (!cleaned) return;

  sources.push({
    text: cleaned,
    numericTokens: extractNumericTokens(cleaned),
  });
}

function extractFactualUnits(
  artifact: SummaryArtifactForValidation,
): string[] {
  const units = new Set<string>();

  for (const keyPoint of artifact.keyPoints) {
    addUnit(units, keyPoint);
  }

  let activeSection = "";

  for (const rawLine of artifact.summary.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || /^<!--/u.test(line)) continue;

    const heading = line.match(/^#{2,3}\s+(.+)$/u);
    if (heading) {
      activeSection = stripPresentation(heading[1] ?? "");
      continue;
    }

    if (/^#\s+/u.test(line) || /^>\s*\*/u.test(line)) continue;
    if (/^\|?\s*:?-{3,}/u.test(line)) continue;

    if (/^[-*]\s+/u.test(line)) {
      addUnit(units, line.replace(/^[-*]\s+/u, ""));
      continue;
    }

    if (/^\d+[.)]\s+/u.test(line)) {
      addUnit(units, line.replace(/^\d+[.)]\s+/u, ""));
      continue;
    }

    if (/^\|\s*.+\|\s*$/u.test(line)) {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (
        cells.length > 0 &&
        !cells.every((cell) => /^:?-{3,}:?$/u.test(cell))
      ) {
        addUnit(units, cells.join(" "));
      }
      continue;
    }

    if (
      /^overview$/i.test(activeSection) ||
      /^key points$/i.test(activeSection) ||
      /^key takeaways$/i.test(activeSection)
    ) {
      for (const sentence of splitSentences(line)) {
        addUnit(units, sentence);
      }
    }
  }

  return [...units];
}

function addUnit(units: Set<string>, raw: string): void {
  const value = stripPresentation(raw);
  if (value.length >= 4) units.add(value);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|[\r\n]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function stripPresentation(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/\*\*|__|`/gu, "")
    .replace(
      /\s*(?:[_*])?(?:\(|\[)\s*(?:p|pp)\.?\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:\)|\])(?:[_*])?\s*$/giu,
      "",
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function normalise(text: string): string {
  return stripPresentation(text)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+\-., ]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function compactNormalised(text: string): string {
  return normalise(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

function meaningfulTokens(text: string): Set<string> {
  const tokens =
    normalise(text).match(
      /[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu,
    ) ?? [];

  return new Set(
    tokens.filter(
      (token) =>
        token.length >= 2 && !ENGLISH_STOP_WORDS.has(token),
    ),
  );
}

function extractNumericTokens(text: string): Set<string> {
  const matches =
    stripPresentation(text).match(
      /[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu,
    ) ?? [];

  return new Set(
    matches.map((value) =>
      value
        .replace(/\s+/gu, "")
        .replace(/,(?=\d{3}(?:\D|$))/gu, "")
    ),
  );
}

function bestSupport(
  candidate: string,
  sources: SupportSource[],
): { supported: boolean; score: number } {
  const candidateNumbers = extractNumericTokens(candidate);
  let best = 0;

  for (const source of sources) {
    if (
      candidateNumbers.size > 0 &&
      !setIsSubset(candidateNumbers, source.numericTokens)
    ) {
      continue;
    }

    const score = similarity(candidate, source.text);
    best = Math.max(best, score);

    if (score >= supportThreshold(candidate)) {
      return { supported: true, score };
    }
  }

  return { supported: false, score: best };
}

function supportThreshold(candidate: string): number {
  const tokenCount = meaningfulTokens(candidate).size;
  if (tokenCount <= 2) return 0.92;
  if (tokenCount <= 4) return 0.72;
  return 0.55;
}

function similarity(candidate: string, source: string): number {
  const candidateNormalised = normalise(candidate);
  const sourceNormalised = normalise(source);

  if (!candidateNormalised || !sourceNormalised) return 0;
  if (sourceNormalised.includes(candidateNormalised)) return 1;

  if (
    candidateNormalised.length >= 18 &&
    candidateNormalised.includes(sourceNormalised)
  ) {
    return Math.min(
      0.96,
      sourceNormalised.length / candidateNormalised.length + 0.25,
    );
  }

  const tokenCoverage = setCoverage(
    meaningfulTokens(candidateNormalised),
    meaningfulTokens(sourceNormalised),
  );
  const gramCoverage = characterGramCoverage(
    compactNormalised(candidateNormalised),
    compactNormalised(sourceNormalised),
    3,
  );

  return Math.max(tokenCoverage, gramCoverage * 0.90);
}

function characterGramCoverage(
  candidate: string,
  source: string,
  width: number,
): number {
  if (candidate.length < width || source.length < width) {
    return candidate === source ? 1 : 0;
  }

  return setCoverage(
    grams(candidate, width),
    grams(source, width),
  );
}

function grams(text: string, width: number): Set<string> {
  const output = new Set<string>();
  for (let index = 0; index <= text.length - width; index += 1) {
    output.add(text.slice(index, index + width));
  }
  return output;
}

function setCoverage(
  candidate: Set<string>,
  source: Set<string>,
): number {
  if (candidate.size === 0) return 0;

  let matches = 0;
  for (const value of candidate) {
    if (source.has(value)) matches += 1;
  }

  return matches / candidate.size;
}

function setIsSubset(
  candidate: Set<string>,
  source: Set<string>,
): boolean {
  for (const value of candidate) {
    if (!source.has(value)) return false;
  }
  return true;
}

function selectMajorFacts(
  facts: AtomicFact[],
  mode: SummaryMode,
  limit: number,
): AtomicFact[] {
  let candidates = mode === "exam"
    ? facts.filter((fact) => EXAM_FACT_TYPES.has(fact.type))
    : facts.filter((fact) => fact.type !== "example");

  if (candidates.length === 0) candidates = facts;

  const ranked = [...candidates].sort(
    (left, right) =>
      right.importanceScore - left.importanceScore ||
      right.confidence - left.confidence,
  );
  const selected: AtomicFact[] = [];
  const selectedIds = new Set<string>();
  const representedSections = new Set<string>();

  for (const fact of ranked) {
    if (representedSections.has(fact.sourceSectionId)) continue;

    selected.push(fact);
    selectedIds.add(fact.id);
    representedSections.add(fact.sourceSectionId);

    if (selected.length >= limit) return selected;
  }

  for (const fact of ranked) {
    if (selectedIds.has(fact.id)) continue;
    selected.push(fact);
    if (selected.length >= limit) break;
  }

  return selected;
}

function selectRequiredSections(
  sections: SectionCoverage[],
  supportedFacts: AtomicFact[],
  mode: SummaryMode,
  limit: number,
): SectionCoverage[] {
  const factsById = new Map(
    supportedFacts.map((fact) => [fact.id, fact]),
  );
  const visible = sections.filter(
    (section) =>
      section.status === "covered" &&
      section.factIds.some((id) => factsById.has(id)),
  );

  if (!Number.isFinite(limit) || visible.length <= limit) {
    return visible;
  }

  const candidates = mode === "exam"
    ? visible.filter((section) =>
        section.factIds.some((id) => {
          const fact = factsById.get(id);
          return fact ? EXAM_FACT_TYPES.has(fact.type) : false;
        }),
      )
    : visible;
  const source = candidates.length > 0 ? candidates : visible;

  if (source.length <= limit) return source;
  if (limit <= 1) return source.slice(0, 1);

  const selectedIndexes = new Set<number>();
  for (let index = 0; index < limit; index += 1) {
    selectedIndexes.add(
      Math.round(
        (index * (source.length - 1)) / (limit - 1),
      ),
    );
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => source[index])
    .filter((item): item is SectionCoverage => Boolean(item));
}

function factIsRepresented(
  fact: AtomicFact,
  summary: string,
  factualUnits: string[],
): boolean {
  const factNumbers = extractNumericTokens(fact.content);
  const summaryNumbers = extractNumericTokens(summary);

  if (
    factNumbers.size > 0 &&
    !setIsSubset(factNumbers, summaryNumbers)
  ) {
    return false;
  }

  const normalisedFact = normalise(fact.content);
  if (
    normalisedFact &&
    normalise(summary).includes(normalisedFact)
  ) {
    return true;
  }

  return factualUnits.some(
    (unit) =>
      similarity(fact.content, unit) >=
      supportThreshold(fact.content),
  );
}

function sectionIsRepresented(
  section: SectionCoverage,
  summary: string,
  supportedFacts: AtomicFact[],
  factualUnits: string[],
): boolean {
  const heading = normalise(section.heading);
  if (heading && normalise(summary).includes(heading)) {
    return true;
  }

  const sectionFactIds = new Set(section.factIds);
  return supportedFacts.some(
    (fact) =>
      sectionFactIds.has(fact.id) &&
      factIsRepresented(fact, summary, factualUnits),
  );
}

function isGenericNonFact(value: string): boolean {
  const valueNormalised = normalise(value);
  return GENERIC_NON_FACT_PATTERNS.some((pattern) =>
    pattern.test(valueNormalised),
  );
}

function factSupportSource(fact: AtomicFact): SupportSource {
  return {
    text: fact.content,
    numericTokens: new Set(fact.numericTokens),
  };
}

interface QualityTopicBlock {
  heading: string;
  explanation: string;
  keyPoints: string[];
}

function parseQualityTopicBlock(
  block: { heading: string; body: string },
): QualityTopicBlock {
  const lines = block.body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  let explanation = "";
  const keyPoints: string[] = [];
  let inKeyPoints = false;

  for (const line of lines) {
    const simple = line.match(/^\*\*Simple explanation:\*\*\s*(.+)$/iu);
    if (simple?.[1]) {
      explanation = stripPresentation(simple[1]);
      continue;
    }
    if (/^\*\*(?:Important key points|Important details):\*\*$/iu.test(line)) {
      inKeyPoints = true;
      continue;
    }
    if (inKeyPoints && /^[-*]\s+/u.test(line)) {
      keyPoints.push(stripPresentation(line.replace(/^[-*]\s+/u, "")));
    }
  }

  return {
    heading: stripPresentation(block.heading),
    explanation,
    keyPoints: keyPoints.filter(Boolean),
  };
}

function topicIsCoherent(topic: QualityTopicBlock): boolean {
  if (!isSummaryTopicHeadingEligible(topic.heading)) return false;
  if (!topic.explanation || !isSummaryTopicPointUseful(topic.explanation)) return false;

  const explanationAlignment = summaryTopicTextAlignment(
    topic.heading,
    topic.explanation,
  );
  const frameworkLike = /\b(?:framework|process|procedure|workflow|method)\b/iu.test(topic.heading);
  if (!frameworkLike && explanationAlignment < 0.14) return false;

  if (topic.keyPoints.length === 0) return true;
  const useful = topic.keyPoints.filter((point) =>
    isSummaryTopicPointUseful(point, { allowProcedure: frameworkLike }),
  ).length;
  const aligned = topic.keyPoints.filter((point) =>
    Math.max(
      summaryTopicTextAlignment(topic.heading, point),
      semanticTextOverlap(topic.explanation, point),
    ) >= 0.12,
  ).length;

  return useful / topic.keyPoints.length >= 0.7 &&
    aligned / topic.keyPoints.length >= 0.6;
}

function topicExplanationSemanticScore(
  topic: QualityTopicBlock,
  semanticMap: SemanticEvidenceMap,
): number {
  if (!topic.explanation || !isSummaryTopicPointUseful(topic.explanation)) return 0;
  const unit = findBestSemanticUnit(topic.explanation, semanticMap);
  const kind = topicKind(topic.heading);
  if (unit) {
    const sourceHeading = unit.sectionHeading;
    const localPedagogicalRelation =
      normalise(sourceHeading.replace(/^(?:\d+(?:\.\d+)*)\s*[:.\-–—]?\s*/u, "")) === normalise(topic.heading);
    const fit = semanticEvidenceExplanationFit({
      heading: topic.heading,
      unit,
      kind,
      localPedagogicalRelation,
    });
    if (fit.passed) return Math.max(0.58, fit.score);
    return Math.min(0.4, fit.score);
  }
  return alignmentQuality(
    semanticTopicTextAlignment(topic.heading, topic.explanation),
    0.32,
  );
}

function topicPointSemanticScore(
  topic: QualityTopicBlock,
  point: string,
  semanticMap: SemanticEvidenceMap,
): number {
  const pointUnit = findBestSemanticUnit(point, semanticMap);
  const explanationUnit = findBestSemanticUnit(topic.explanation, semanticMap);
  if (pointUnit && explanationUnit) {
    const framework = semanticMap.frameworks.find((item) =>
      semanticTopicTextAlignment(topic.heading, item.name) >= 0.6,
    );
    const sameFramework = Boolean(
      framework &&
      [framework.parentSectionId, ...framework.componentSectionIds].includes(pointUnit.sectionId),
    );
    const fit = semanticEvidencePointFit({
      heading: topic.heading,
      explanation: explanationUnit,
      unit: pointUnit,
      kind: topicKind(topic.heading),
      sameFramework,
    });
    return fit.passed ? Math.max(0.58, fit.score) : Math.min(0.4, fit.score);
  }

  const alignment = Math.max(
    semanticTopicTextAlignment(topic.heading, point),
    semanticTextOverlap(topic.explanation, point),
  );
  return alignmentQuality(alignment, 0.24);
}

function findBestSemanticUnit(
  text: string,
  semanticMap: SemanticEvidenceMap,
): SemanticEvidenceUnit | null {
  const numbers = extractNumericTokens(text);
  let bestUnit: SemanticEvidenceUnit | null = null;
  let bestScore = 0;

  for (const unit of semanticMap.units) {
    if (numbers.size > 0 && !setIsSubset(numbers, new Set(unit.fact.numericTokens))) continue;
    const score = similarity(text, unit.fact.content);
    if (score > bestScore) {
      bestScore = score;
      bestUnit = unit;
    }
  }

  return bestScore >= Math.min(0.55, supportThreshold(text)) ? bestUnit : null;
}

function topicKind(heading: string): "topic" | "framework" | "procedure" {
  if (/\bframework\b/iu.test(heading)) return "framework";
  if (/\b(?:process|procedure|workflow)\b/iu.test(heading)) return "procedure";
  return "topic";
}

function frameworkIntegrityQuality(
  topics: QualityTopicBlock[],
  semanticMap: SemanticEvidenceMap,
): number {
  const publishedFrameworks = semanticMap.frameworks
    .map((framework) => ({
      framework,
      topic: topics.find((topic) =>
        semanticTopicTextAlignment(topic.heading, framework.name) >= 0.6,
      ),
    }))
    .filter((item): item is { framework: SemanticEvidenceMap["frameworks"][number]; topic: QualityTopicBlock } => Boolean(item.topic));

  if (publishedFrameworks.length === 0) return 1;
  const scores = publishedFrameworks.map(({ framework, topic }) => {
    const body = [topic.explanation, ...topic.keyPoints].join(" ");
    const componentUnits = semanticMap.units.filter((unit) =>
      framework.componentSectionIds.includes(unit.sectionId) && unit.pointEligible,
    );
    if (componentUnits.length === 0) return 1;
    const represented = componentUnits.filter((unit) =>
      similarity(unit.fact.content, body) >= Math.min(0.45, supportThreshold(unit.fact.content)),
    ).length;
    return represented / componentUnits.length;
  });
  return averageQuality(scores, 1);
}

function extractSummaryTitle(summary: string): string | null {
  const match = summary.match(/^#\s+(.+)$/mu);
  return match?.[1] ? stripPresentation(match[1]) : null;
}

function semanticTextOverlap(left: string, right: string): number {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) matches += 1;
  }
  return matches / Math.min(leftTokens.size, Math.max(1, rightTokens.size));
}

function alignmentQuality(value: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(1, Math.max(0, value / target));
}

function averageQuality(values: number[], emptyValue: number): number {
  if (values.length === 0) return emptyValue;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hasSectionHeading(summary: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\s*$`, "imu").test(summary);
}

function extractSectionBullets(summary: string, heading: string): string[] {
  const lines = summary.split(/\r?\n/u);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const sectionRe = new RegExp(`^##\\s+${escaped}\\s*$`, "iu");
  let active = false;
  const output: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (sectionRe.test(line)) {
      active = true;
      continue;
    }
    if (active && /^##\s+/u.test(line)) break;
    if (!active) continue;
    if (/^[-*]\s+/u.test(line)) {
      const value = stripPresentation(line.replace(/^[-*]\s+/u, ""));
      if (value) output.push(value);
    }
  }

  return output;
}

function extractStudyTopicBlocks(summary: string): Array<{ heading: string; body: string }> {
  const lines = summary.split(/\r?\n/u);
  const output: Array<{ heading: string; body: string }> = [];
  let inTopics = false;
  let current: { heading: string; bodyLines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    output.push({
      heading: current.heading,
      body: current.bodyLines.join("\n").trim(),
    });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+(?:Study Topics|Detailed Study Notes)\s*$/iu.test(trimmed)) {
      inTopics = true;
      continue;
    }
    if (inTopics && /^##\s+/u.test(trimmed)) {
      flush();
      break;
    }
    if (!inTopics) continue;

    const heading = trimmed.match(/^###\s+(.+)$/u);
    if (heading?.[1]) {
      flush();
      current = { heading: heading[1].trim(), bodyLines: [] };
      continue;
    }
    if (current && trimmed) current.bodyLines.push(trimmed);
  }

  if (inTopics) flush();
  return output;
}

function extractSectionNoteHeadings(summary: string): string[] {
  const lines = summary.split(/\r?\n/u);
  const output: string[] = [];
  let inSectionNotes = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Section Notes\s*$/iu.test(trimmed)) {
      inSectionNotes = true;
      continue;
    }
    if (inSectionNotes && /^##\s+/u.test(trimmed)) break;
    const heading = inSectionNotes ? trimmed.match(/^###\s+(.+)$/u) : null;
    if (heading?.[1]) output.push(heading[1].trim());
  }

  return output;
}

function duplicateTextRatio(values: string[]): number {
  if (values.length <= 1) return 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const value of values) {
    const key = normalise(value);
    if (!key) continue;
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates / values.length;
}

function summaryReadabilityRatio(summary: string): number {
  const lines = summary
    .split(/\n+/u)
    .map((line) => line.replace(/^#+\s*|^(?:[-*]|\d+[.)])\s*/u, "").trim())
    .filter((line) => line.length >= 12);
  if (lines.length === 0) return 1;
  const readable = lines.filter((line) => {
    const words = line.split(/\s+/u).filter(Boolean).length;
    return words <= 42 && line.length <= 320;
  }).length;
  return readable / lines.length;
}

function ratio(
  numerator: number,
  denominator: number,
  emptyValue: number,
): number {
  return denominator === 0
    ? emptyValue
    : numerator / denominator;
}

import type {
  AtomicFact,
  GroundedKnowledge,
  ImportantConcept,
  QualifiedTerm,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import type { ReliableDocumentProfile } from "@/server/intelligence/reliability/types";
import {
  buildSemanticEvidenceMap,
} from "@/server/intelligence/semantic-evidence";
import { NOTE_RULES } from "@/server/entities/note.entity";
import type { SummaryMode } from "@/types/summary";
import {
  isActionableSummaryWarningFact,
  isMeaningfulSummaryNumberFact,
  isSummaryCautionHeading,
  isSummaryHeadlineTextEligible,
  selectSummaryConcepts,
  selectSummaryKeyTerms,
} from "@/server/services/summary/summary-learning-structure.service";
import {
  buildLearningEvidenceProfile,
  factLearningUtilityScore,
  type LearningEvidenceRole,
} from "@/server/services/quality/learning-evidence.service";
import {
  buildSummaryLearningTopics,
  isSummaryTopicPointUseful,
  type SummaryLearningTopic,
} from "@/server/services/summary/summary-topic-learning.service";

export const STUDY_NOTES_VERSION = "v3.2" as const;

export function getStudyNotesVersionMarker(
  mode: SummaryMode = "comprehensive",
): string {
  return `<!-- intelligence-engine:${STUDY_NOTES_VERSION};mode:${mode} -->`;
}

export const STUDY_NOTES_VERSION_MARKER =
  getStudyNotesVersionMarker("comprehensive");

export interface GroundedStudyNotesResult {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  confidence: number;
  status: "ready" | "partial";
  profile: ReliableDocumentProfile | null;
}

interface BuildMarkdownOptions {
  factsPerSection: number;
  compactSections: boolean;
}

interface StudyNotesModeProfile {
  overviewLimit: number;
  keyPointLimit: number;
  topicLimit: number;
  pointsPerTopic: number;
  conceptLimit: number;
  keyTermLimit: number;
  numberLimit: number;
  warningLimit: number;
  procedureLimit: number;
  comparisonLimit: number;
  exampleLimit: number;
  practicalReferenceLimit: number;
  factsPerSection: number;
}

const MODE_PROFILES: Record<SummaryMode, StudyNotesModeProfile> = {
  concise: {
    overviewLimit: 2,
    keyPointLimit: 5,
    topicLimit: 5,
    pointsPerTopic: 4,
    conceptLimit: 8,
    keyTermLimit: 6,
    numberLimit: 4,
    warningLimit: 4,
    procedureLimit: 5,
    comparisonLimit: 4,
    exampleLimit: 3,
    practicalReferenceLimit: 4,
    factsPerSection: 2,
  },
  comprehensive: {
    overviewLimit: 3,
    keyPointLimit: 8,
    topicLimit: 10,
    pointsPerTopic: 6,
    conceptLimit: 16,
    keyTermLimit: 16,
    numberLimit: 10,
    warningLimit: 10,
    procedureLimit: 10,
    comparisonLimit: 8,
    exampleLimit: 6,
    practicalReferenceLimit: 8,
    factsPerSection: 6,
  },
  exam: {
    overviewLimit: 2,
    keyPointLimit: 8,
    topicLimit: 8,
    pointsPerTopic: 6,
    conceptLimit: 12,
    keyTermLimit: 12,
    numberLimit: 10,
    warningLimit: 8,
    procedureLimit: 7,
    comparisonLimit: 6,
    exampleLimit: 4,
    practicalReferenceLimit: 6,
    factsPerSection: 4,
  },
};

export function buildGroundedStudyNotes(
  grounding: GroundedKnowledge,
  profile: ReliableDocumentProfile | null,
  fallbackTitle: string,
  options: { mode?: SummaryMode } = {},
): GroundedStudyNotesResult {
  const mode = options.mode ?? "comprehensive";
  const modeProfile = MODE_PROFILES[mode];
  const learningProfile = buildLearningEvidenceProfile(grounding);
  const supportedFacts = uniqueFacts(
    learningProfile.facts.filter(
      (fact) => fact.verificationStatus === "supported",
    ),
  );
  const sectionHeadingById = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );
  const sourceOrderBySectionId = new Map(
    grounding.sections.map((section, index) => [section.sectionId, index]),
  );
  const cautionSectionIds = new Set(
    grounding.sections
      .filter((section) => isSummaryCautionHeading(section.heading))
      .map((section) => section.sectionId),
  );
  const isExplicitCautionFact = (fact: AtomicFact): boolean =>
    ["warning", "common_mistake", "limitation"].includes(fact.type);

  const warningFacts = selectFacts(
    supportedFacts
      .filter((fact) =>
        isExplicitCautionFact(fact) ||
        cautionSectionIds.has(fact.sourceSectionId),
      )
      .map((fact) =>
        cautionSectionIds.has(fact.sourceSectionId) &&
          !isExplicitCautionFact(fact)
          ? { ...fact, type: "common_mistake" as const }
          : fact,
      )
      .filter((fact) =>
        isActionableSummaryWarningFact(
          fact,
          sectionHeadingById.get(fact.sourceSectionId) ?? "",
        ),
      ),
    ["limitation", "warning", "common_mistake"],
    modeProfile.warningLimit,
  );
  const warningIds = new Set(warningFacts.map((fact) => fact.id));

  const procedureFacts = selectProcedureFacts(
    learningProfile.procedureFacts.filter((fact) => !warningIds.has(fact.id)),
    modeProfile.procedureLimit,
    sourceOrderBySectionId,
  );
  const procedureIds = new Set(procedureFacts.map((fact) => fact.id));

  const numberFacts = selectImportantNumberFacts(
    supportedFacts.filter(
      (fact) =>
        !warningIds.has(fact.id) &&
        !procedureIds.has(fact.id) &&
        isImportantNumberOrFormulaFact(fact),
    ),
    modeProfile.numberLimit,
  );
  const numberIds = new Set(numberFacts.map((fact) => fact.id));

  const comparisonFacts = selectComparisonFacts(
    supportedFacts.filter(
      (fact) =>
        !warningIds.has(fact.id) &&
        !procedureIds.has(fact.id) &&
        !numberIds.has(fact.id),
    ),
    sectionHeadingById,
    modeProfile.comparisonLimit,
  );
  const comparisonIds = new Set(comparisonFacts.map((fact) => fact.id));

  const exampleFacts = selectUsefulExampleFacts(
    learningProfile.exampleFacts,
    modeProfile.exampleLimit,
  );
  const exampleIds = new Set(exampleFacts.map((fact) => fact.id));

  const practicalReferenceFacts = selectPracticalReferenceFacts(
    grounding.facts,
    learningProfile.rolesByFactId,
    sectionHeadingById,
    modeProfile.practicalReferenceLimit,
  );
  const practicalReferenceIds = new Set(
    practicalReferenceFacts.map((fact) => fact.id),
  );

  const topicExcludedFactIds = new Set([
    ...warningIds,
    ...procedureIds,
    ...comparisonIds,
    ...exampleIds,
    ...practicalReferenceIds,
    ...numberFacts
      .filter((fact) => fact.type === "formula" || fact.type === "number")
      .map((fact) => fact.id),
  ]);
  const topicEligibleFacts = supportedFacts.filter(
    (fact) =>
      learningProfile.rolesByFactId.get(fact.id) !== "example" &&
      !topicExcludedFactIds.has(fact.id),
  );
  const factsById = new Map(
    topicEligibleFacts.map((fact) => [fact.id, fact]),
  );
  const topicSections = sectionsForFacts(
    learningProfile.sections,
    new Set(topicEligibleFacts.map((fact) => fact.id)),
  );
  const semanticMap = buildSemanticEvidenceMap({
    sections: topicSections,
    facts: topicEligibleFacts,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    documentTitle: profile?.title.value ?? fallbackTitle,
  });
  const summaryTopics = buildSummaryLearningTopics({
    sections: topicSections,
    factsById,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    rolesByFactId: learningProfile.rolesByFactId,
    semanticMap,
    mode,
    topicLimit: modeProfile.topicLimit,
    pointsPerTopic: modeProfile.pointsPerTopic,
    documentTitle: profile?.title.value ?? fallbackTitle,
  });

  const overviewFacts = selectTopicOverviewFacts(
    summaryTopics,
    topicEligibleFacts,
    modeProfile.overviewLimit,
    learningProfile.rolesByFactId,
    semanticMap,
  );
  const overviewKeys = new Set(
    overviewFacts.map((fact) => normalise(fact.content)),
  );
  const keyPointCandidates = topicEligibleFacts.filter(
    (fact) => !overviewKeys.has(normalise(fact.content)),
  );
  const keyPointFacts = selectSummaryKeyPointFacts(
    keyPointCandidates.length > 0 ? keyPointCandidates : topicEligibleFacts,
    modeProfile.keyPointLimit,
    learningProfile.rolesByFactId,
    semanticMap,
  );
  const summaryConcepts = selectSummaryConcepts(
    learningProfile.concepts,
    modeProfile.conceptLimit,
  );
  const importantConcepts = summaryConcepts.map((concept) => concept.name);
  const summaryKeyTerms = selectSummaryKeyTerms(
    learningProfile.keyTerms,
    modeProfile.keyTermLimit,
  ).filter(isLearnerFacingKeyTerm);
  const title = cleanHeading(profile?.title.value ?? fallbackTitle) || "Study Notes";

  const render = (renderOptions: BuildMarkdownOptions): string => {
    const renderedTopics = renderLearningTopics(
      summaryTopics,
      renderOptions.factsPerSection,
      renderOptions.compactSections,
    );
    const detailedNotes = renderedTopics || renderDetailedFallback(keyPointFacts);

    return [
      `# ${title}`,
      getStudyNotesVersionMarker(mode),
      "## Overview",
      renderOverviewList(overviewFacts, title),
      "## Key Points",
      renderRequiredFactList(keyPointFacts, overviewFacts),
      "## Key Concepts",
      renderConceptList(summaryConcepts),
      "## Key Terms",
      renderKeyTermList(summaryKeyTerms),
      "## Detailed Study Notes",
      detailedNotes,
      procedureFacts.length > 0 ? "## Processes / Steps" : "",
      renderProcedureList(procedureFacts),
      comparisonFacts.length > 0 ? "## Comparisons" : "",
      renderFactList(comparisonFacts),
      exampleFacts.length > 0 ? "## Examples" : "",
      renderFactList(exampleFacts),
      warningFacts.length > 0 ? "## Warnings / Common Mistakes" : "",
      renderWarningList(warningFacts),
      numberFacts.length > 0 ? "## Important Numbers / Formulas" : "",
      renderFactList(numberFacts),
      practicalReferenceFacts.length > 0 ? "## Practical Reference" : "",
      renderFactList(practicalReferenceFacts),
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  };

  let summary = render({
    factsPerSection: modeProfile.factsPerSection,
    compactSections: false,
  });

  const reductionSteps = [16, 12, 8, 5, 3, 2, 1].filter(
    (value) => value < modeProfile.factsPerSection,
  );
  for (const factsPerSection of reductionSteps) {
    if (summary.length <= NOTE_RULES.SUMMARY_MAX) break;
    summary = render({ factsPerSection, compactSections: false });
  }

  if (summary.length > NOTE_RULES.SUMMARY_MAX) {
    summary = render({ factsPerSection: 1, compactSections: true });
  }

  if (summary.length > NOTE_RULES.SUMMARY_MAX) {
    throw new Error(
      "Grounded study notes exceed the storage limit even in compact coverage mode.",
    );
  }

  return {
    summary,
    keyPoints: keyPointFacts.map((fact) => fact.content),
    importantConcepts,
    confidence: grounding.quality.score,
    status: grounding.quality.passed ? "ready" : "partial",
    profile,
  };
}

function selectTopicOverviewFacts(
  topics: SummaryLearningTopic[],
  fallbackFacts: AtomicFact[],
  limit: number,
  rolesByFactId: Map<string, LearningEvidenceRole>,
  semanticMap: ReturnType<typeof buildSemanticEvidenceMap>,
): AtomicFact[] {
  const candidates = uniqueFacts([
    ...[...topics]
      .sort((left, right) => right.score - left.score)
      .flatMap((topic) => [topic.explanation, ...topic.keyPoints]),
    ...fallbackFacts,
  ]).filter((fact) => {
    const unit = semanticMap.unitsByFactId.get(fact.id);
    return Boolean(
      unit?.explanationEligible &&
      !["metadata", "narrative", "transition", "exercise", "example", "reference"].includes(unit.role) &&
      !["procedure_step", "number", "warning", "common_mistake", "limitation"].includes(fact.type) &&
      isSummaryHeadlineTextEligible(fact.content) &&
      isSummaryTopicPointUseful(fact.content) &&
      !/^(?:my|our|your|i|we|you|they|someone|there|this|that|these|those)\b/iu.test(
        fact.content.trim(),
      )
    );
  });

  const semanticRolePriority = new Map<string, number>([
    ["objective", 0],
    ["method", 1],
    ["finding", 2],
    ["cause_effect", 3],
    ["core", 4],
    ["supporting", 5],
  ]);

  const ranked = [...candidates].sort((left, right) => {
    const leftUnit = semanticMap.unitsByFactId.get(left.id);
    const rightUnit = semanticMap.unitsByFactId.get(right.id);
    const leftRole = rolesByFactId.get(left.id) ?? "supporting";
    const rightRole = rolesByFactId.get(right.id) ?? "supporting";
    const leftPriority = semanticRolePriority.get(leftUnit?.role ?? "") ?? 20;
    const rightPriority = semanticRolePriority.get(rightUnit?.role ?? "") ?? 20;

    return (
      leftPriority - rightPriority ||
      factLearningUtilityScore(right, rightRole) -
        factLearningUtilityScore(left, leftRole) ||
      right.importanceScore - left.importanceScore
    );
  });

  const selected: AtomicFact[] = [];
  const usedSemanticRoles = new Set<string>();
  const usedSections = new Set<string>();

  for (const fact of ranked) {
    const role = semanticMap.unitsByFactId.get(fact.id)?.role ?? "supporting";
    if (usedSemanticRoles.has(role) || usedSections.has(fact.sourceSectionId)) {
      continue;
    }

    selected.push(fact);
    usedSemanticRoles.add(role);
    usedSections.add(fact.sourceSectionId);
    if (selected.length >= limit) return selected;
  }

  for (const fact of ranked) {
    if (selected.some((item) => item.id === fact.id)) continue;
    if (usedSections.has(fact.sourceSectionId)) continue;
    selected.push(fact);
    usedSections.add(fact.sourceSectionId);
    if (selected.length >= limit) break;
  }

  return selected;
}

function selectSummaryKeyPointFacts(
  facts: AtomicFact[],
  limit: number,
  rolesByFactId: Map<string, LearningEvidenceRole>,
  semanticMap: ReturnType<typeof buildSemanticEvidenceMap>,
): AtomicFact[] {
  return selectLearningDiverseFacts(
    facts.filter((fact) => {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      return Boolean(
        unit?.pointEligible &&
        !["metadata", "narrative", "transition", "exercise", "example"].includes(unit.role) &&
        isTakeawayFact(fact)
      );
    }),
    limit,
    rolesByFactId,
    [
      "objective",
      "rule",
      "relationship",
      "condition",
      "result",
      "definition",
      "claim",
    ],
  );
}

function sectionsForFacts(
  sections: SectionCoverage[],
  visibleFactIds: Set<string>,
): SectionCoverage[] {
  return sections
    .map((section) => ({
      ...section,
      factIds: section.factIds.filter((id) => visibleFactIds.has(id)),
    }))
    .filter((section) => section.factIds.length > 0);
}

function selectProcedureFacts(
  facts: AtomicFact[],
  limit: number,
  sourceOrderBySectionId: Map<string, number>,
): AtomicFact[] {
  return uniqueFacts(facts)
    .filter((fact) => {
      const text = fact.content.normalize("NFKC").replace(/\s+/gu, " ").trim();
      const words = text.split(/\s+/u).filter(Boolean);
      if (text.length < 18 || words.length < 4 || text.endsWith(":")) return false;
      if (
        /^(?:introduction|summary|overview|use\s+case\s+list|use\s+case\s+diagram|domain\s+model|validation\s+checklist|questions?\s+and\s+answers?)\.?$/iu.test(
          text,
        )
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) =>
      (sourceOrderBySectionId.get(left.sourceSectionId) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrderBySectionId.get(right.sourceSectionId) ?? Number.MAX_SAFE_INTEGER) ||
      right.importanceScore - left.importanceScore,
    )
    .slice(0, limit);
}

function selectComparisonFacts(
  facts: AtomicFact[],
  headingBySectionId: Map<string, string>,
  limit: number,
): AtomicFact[] {
  return uniqueFacts(
    facts.filter((fact) => {
      const heading = headingBySectionId.get(fact.sourceSectionId) ?? "";
      const text = fact.content.trim();
      const comparisonHeading = /\b(?:comparison|compare|differences?|similarities?|versus|vs\.?|advantages?\s+and\s+disadvantages?|pros?\s+and\s+cons?)\b/iu.test(heading);
      const comparisonText = /\b(?:compared\s+(?:with|to)|whereas|unlike|versus|vs\.?|differs?|different\s+from|similar\s+to|both\b|more\s+than|less\s+than|higher\s+than|lower\s+than|advantage|disadvantage|in\s+contrast)\b/iu.test(text);
      return comparisonHeading ||
        (comparisonText && ["relationship", "rule", "claim", "result"].includes(fact.type));
    }),
  )
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, limit);
}

function selectUsefulExampleFacts(
  facts: AtomicFact[],
  limit: number,
): AtomicFact[] {
  return uniqueFacts(
    facts.filter((fact) => {
      const text = fact.content.normalize("NFKC").replace(/\s+/gu, " ").trim();
      const words = text.split(/\s+/u).filter(Boolean);
      const hasTeachingPredicate =
        /\b(?:is|are|was|were|has|have|uses?|used|includes?|included|shows?|demonstrates?|can|could|may|corresponds?|consists?|provides?|allows?|requires?|increases?|decreases?|maps?|connects?|represents?)\b/iu.test(
          text,
        );

      return (
        text.length >= 36 &&
        text.length <= 420 &&
        words.length >= 7 &&
        !text.endsWith(":") &&
        !text.endsWith("?") &&
        hasTeachingPredicate &&
        !/^(?:i|we|you|my|our|let(?:'|’)s|imagine|suppose|write|answer|consider)\b/iu.test(
          text,
        ) &&
        !/^(?:a\s+number\s+of|several)\s+(?:authors?|studies|researchers?|papers?)\b/iu.test(
          text,
        ) &&
        !/\b(?:shown|seen|illustrated)\s+in\s+(?:figure|table|chart|diagram)\s*\d+\b/iu.test(
          text,
        ) &&
        !/\b(?:section|chapter)\s+\d+\b.*\b(?:shows?|describes?|discusses?|presents?)\b/iu.test(
          text,
        )
      );
    }),
  )
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, limit);
}

function selectPracticalReferenceFacts(
  facts: AtomicFact[],
  rolesByFactId: Map<string, LearningEvidenceRole>,
  headingBySectionId: Map<string, string>,
  limit: number,
): AtomicFact[] {
  return uniqueFacts(
    facts.filter((fact) => {
      if (
        fact.verificationStatus !== "supported" ||
        fact.evidence.length === 0 ||
        ["warning", "common_mistake", "limitation", "example"].includes(fact.type)
      ) {
        return false;
      }

      const role = rolesByFactId.get(fact.id);
      const heading = headingBySectionId.get(fact.sourceSectionId) ?? "";
      const text = fact.content.trim();
      const practicalHeading = /\b(?:quick\s+reference|practical\s+reference|reference|commands?|configuration|syntax|settings?|parameters?|checklist|cheat\s*sheet)\b/iu.test(heading);
      const concreteReference =
        /`[^`]+`/u.test(text) ||
        /(?:^|\s)--?[a-z][\w-]*\b/u.test(text) ||
        /\b(?:syntax|command|parameter|option|default|threshold|port|address|mask|gateway)\b[^.]{0,90}(?:[:=]|\b\d+(?:\.\d+)*\b)/iu.test(text) ||
        /\b[A-Z][A-Z0-9_]{2,}\s*=\s*\S+/u.test(text);

      return concreteReference && (role === "reference" || practicalHeading || fact.type === "rule");
    }),
  )
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, limit);
}

function isImportantNumberOrFormulaFact(fact: AtomicFact): boolean {
  if (fact.type === "formula") return true;

  const meaningfulNumericText =
    /\b\d+(?:\.\d+)?\s*(?:%|percent|ms\b|s\b|seconds?|minutes?|hours?|bytes?|kb\b|mb\b|gb\b|v\b|volts?|hz\b|khz\b|mhz\b|ghz\b|ports?|samples?|cases?|users?|items?)\b/iu.test(fact.content) ||
    /[=<>±×÷]/u.test(fact.content);

  if (fact.type === "number") {
    return isMeaningfulSummaryNumberFact(fact);
  }
  if (fact.type === "result") {
    return isMeaningfulSummaryNumberFact(fact) &&
      (fact.numericTokens.length > 0 || meaningfulNumericText);
  }

  return meaningfulNumericText;
}


function selectImportantNumberFacts(
  facts: AtomicFact[],
  limit: number,
): AtomicFact[] {
  const typePriority = new Map<AtomicFact["type"], number>([
    ["formula", 0],
    ["number", 1],
    ["result", 2],
    ["rule", 3],
    ["claim", 4],
  ]);
  return uniqueFacts(facts)
    .sort((left, right) =>
      (typePriority.get(left.type) ?? 9) - (typePriority.get(right.type) ?? 9) ||
      right.importanceScore - left.importanceScore,
    )
    .slice(0, limit);
}

function renderOverviewList(facts: AtomicFact[], title: string): string {
  if (facts.length === 0) {
    return `- Focus: verified learning topics from ${title}.`;
  }

  return facts
    .map((fact) => `- ${formatOverviewFact(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
    .join("\n");
}

function renderRequiredFactList(
  facts: AtomicFact[],
  fallbackFacts: AtomicFact[],
): string {
  const source = facts.length > 0 ? facts : fallbackFacts;
  if (source.length === 0) return "";
  return renderFactList(source);
}

function renderConceptList(concepts: ImportantConcept[]): string {
  if (concepts.length === 0) return "";

  return concepts
    .map((concept) => {
      const explanation = shorten(concept.explanation?.trim() ?? "", 180);
      const description = explanation ? `: ${stripTrailingListPunctuation(explanation)}` : "";
      return `- **${concept.name}**${description}${pageLabel(concept.evidence[0]?.pageNumber)}`;
    })
    .join("\n");
}

function isLearnerFacingKeyTerm(term: QualifiedTerm): boolean {
  const label = term.term.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const definition = term.definition
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  if (!label || !definition) return false;
  if (
    /^(?:data\s+from|toolset\s+provided\s+by|some\s+of|one\s+of|any\s+of|many\s+of)\b/iu.test(
      label,
    )
  ) {
    return false;
  }
  if (
    /^(?:one|two|three|several|many|few)\s+(?:probabilit|values?|things?|items?|forms?|types?|ways?|steps?)\b/iu.test(
      label,
    )
  ) {
    return false;
  }
  if (/\b(?:figure|table|section|chapter|page)\s*\d+\b/iu.test(label)) {
    return false;
  }
  if (
    /^(?:is\s+)?(?:described|discussed|shown|presented|covered|introduced|explained)\s+(?:in|by)\s+(?:section|chapter|figure|table|page)\b/iu.test(
      definition,
    )
  ) {
    return false;
  }
  if (
    /\b(?:section|chapter|figure|table)\s+\d+\b.*\b(?:shows?|describes?|discusses?|presents?)\b/iu.test(
      definition,
    )
  ) {
    return false;
  }

  return definition.split(/\s+/u).filter(Boolean).length >= 4;
}

function renderKeyTermList(terms: QualifiedTerm[]): string {
  if (terms.length === 0) return "";

  return terms
    .map((term) =>
      `- **${term.term}:** ${stripTrailingListPunctuation(term.definition)}${pageLabel(term.evidence[0]?.pageNumber)}`,
    )
    .join("\n");
}

function renderDetailedFallback(facts: AtomicFact[]): string {
  if (facts.length === 0) return "";
  return renderFactList(facts);
}

function renderLearningTopics(
  topics: SummaryLearningTopic[],
  pointsPerTopic: number,
  compact: boolean,
): string {
  return topics
    .map((topic) => {
      const explanation = shorten(
        stripTrailingListPunctuation(topic.explanation.content),
        compact ? 150 : 220,
      );
      const points = topic.keyPoints
        .slice(0, pointsPerTopic)
        .map((fact) =>
          `- ${stripTrailingListPunctuation(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`,
        )
        .join("\n");
      const explanationPage = pageLabel(topic.explanation.evidence[0]?.pageNumber);

      return [
        `### ${topic.heading}`,
        `**Simple explanation:** ${explanation}${explanationPage}`,
        points ? "**Important details:**" : "",
        points,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function renderProcedureList(facts: AtomicFact[]): string {
  return facts
    .map((fact, index) =>
      `${index + 1}. ${stripTrailingListPunctuation(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`,
    )
    .join("\n");
}

function formatOverviewFact(value: string): string {
  const content = value.trim();
  const subjectlessVerb = content.match(
    /^(confirms?|allows?|ensures?|builds?|prevents?|explains?|shows?|demonstrates?)\b/i,
  );

  if (subjectlessVerb) {
    return stripTrailingListPunctuation(`It ${lowercaseFirst(content)}`);
  }

  return stripTrailingListPunctuation(content);
}

function renderFactList(
  facts: AtomicFact[],
  includePage = true,
): string {
  return facts
    .map((fact) =>
      `- ${stripTrailingListPunctuation(fact.content)}${includePage ? pageLabel(fact.evidence[0]?.pageNumber) : ""}`,
    )
    .join("\n");
}

function renderWarningList(facts: AtomicFact[]): string {
  return facts
    .map((fact) => {
      const content = fact.type === "common_mistake"
        ? formatTakeaway(fact)
        : stripTrailingListPunctuation(fact.content);
      return `- ${content}${pageLabel(fact.evidence[0]?.pageNumber)}`;
    })
    .join("\n");
}

function formatTakeaway(fact: AtomicFact): string {
  const content = fact.content.trim().replace(/[.!]+$/, "");

  if (fact.type !== "common_mistake") {
    return stripTrailingListPunctuation(content);
  }

  if (/^forgetting\s+to\s+/i.test(content)) {
    return `Remember to ${lowercaseFirst(content.replace(/^forgetting\s+to\s+/i, ""))}.`;
  }

  if (/^ignoring\s+/i.test(content)) {
    return `Do not ignore ${lowercaseFirst(content.replace(/^ignoring\s+/i, ""))}.`;
  }

  if (/^not\s+/i.test(content)) {
    return `${uppercaseFirst(content.replace(/^not\s+/i, ""))}.`;
  }

  if (/^(?:overloading|using|presenting)\b/i.test(content)) {
    return `Avoid ${lowercaseFirst(content)}.`;
  }

  return `Avoid this common mistake: ${lowercaseFirst(content)}.`;
}

function selectFacts(
  facts: AtomicFact[],
  typePriority: AtomicFact["type"][],
  limit: number,
): AtomicFact[] {
  const priority = new Map(typePriority.map((type, index) => [type, index]));
  return [...facts]
    .filter((fact) => priority.has(fact.type))
    .sort((left, right) =>
      (priority.get(left.type) ?? 99) - (priority.get(right.type) ?? 99) ||
      right.importanceScore - left.importanceScore,
    )
    .slice(0, limit);
}

function selectLearningDiverseFacts(
  facts: AtomicFact[],
  limit: number,
  rolesByFactId: Map<string, LearningEvidenceRole>,
  typePriority: AtomicFact["type"][] = [
    "definition",
    "relationship",
    "objective",
    "rule",
    "condition",
    "result",
    "formula",
    "claim",
    "number",
  ],
): AtomicFact[] {
  const priority = new Map(typePriority.map((type, index) => [type, index]));
  const ranked = [...facts]
    .filter((fact) => priority.has(fact.type))
    .sort((left, right) => {
      const leftRole = rolesByFactId.get(left.id) ?? "supporting";
      const rightRole = rolesByFactId.get(right.id) ?? "supporting";
      return (
        factLearningUtilityScore(right, rightRole) - factLearningUtilityScore(left, leftRole) ||
        (priority.get(left.type) ?? 99) - (priority.get(right.type) ?? 99)
      );
    });
  const selected: AtomicFact[] = [];
  const sectionCounts = new Map<string, number>();

  for (const fact of ranked) {
    if ((sectionCounts.get(fact.sourceSectionId) ?? 0) >= 1) continue;
    selected.push(fact);
    sectionCounts.set(fact.sourceSectionId, 1);
    if (selected.length >= limit) return selected;
  }
  for (const fact of ranked) {
    if (selected.some((item) => item.id === fact.id)) continue;
    if ((sectionCounts.get(fact.sourceSectionId) ?? 0) >= 2) continue;
    selected.push(fact);
    sectionCounts.set(fact.sourceSectionId, (sectionCounts.get(fact.sourceSectionId) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

function uniqueFacts(facts: AtomicFact[]): AtomicFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = normalise(fact.content);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTakeawayFact(fact: AtomicFact): boolean {
  const value = fact.content.normalize("NFKC").replace(/\s+/gu, " ").trim();

  if (
    value.length < 28 ||
    value.endsWith(":") ||
    value.endsWith("?") ||
    ["warning", "common_mistake", "limitation", "procedure_step", "example"].includes(fact.type)
  ) {
    return false;
  }

  if (
    /^(?:i|we|my|our|you|your|they|someone|there|this\s+book|the\s+goal|the\s+questions?|let(?:'|’)s|now|then|later|eventually|notice|try|imagine|suppose|the\s+contents?\s+of\s+(?:the\s+)?(?:remainder|rest)|the\s+remainder\s+of\s+the\s+(?:paper|chapter)|in\s+(?:section|chapter)\s+\d+)\b/iu.test(value)
  ) {
    return false;
  }

  if (!isSummaryTopicPointUseful(value)) return false;

  return [
    "objective",
    "rule",
    "relationship",
    "condition",
    "result",
    "definition",
  ].includes(fact.type) ||
    (fact.type === "claim" && fact.importanceScore >= 0.9);
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\s*\(\s*insert\s+(?:a\s+)?(?:class\s+)?(?:diagram|image|figure|chart)\s*\)\s*/gi, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingListPunctuation(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function lowercaseFirst(value: string): string {
  return value.length > 0
    ? `${value[0].toLocaleLowerCase()}${value.slice(1)}`
    : value;
}

function uppercaseFirst(value: string): string {
  return value.length > 0
    ? `${value[0].toLocaleUpperCase()}${value.slice(1)}`
    : value;
}

function pageLabel(page?: number): string {
  return page ? ` _(p. ${page})_` : "";
}

function shorten(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const candidate = text.slice(0, Math.max(1, maxLength - 1));
  const boundary = Math.max(
    candidate.lastIndexOf(";"),
    candidate.lastIndexOf(","),
    candidate.lastIndexOf(" "),
  );
  return `${candidate.slice(0, boundary >= maxLength * 0.65 ? boundary : candidate.length).trim()}…`;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.%+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

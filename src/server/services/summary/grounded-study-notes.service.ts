import type {
  AtomicFact,
  GroundedKnowledge,
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

export const STUDY_NOTES_VERSION = "v3.0" as const;

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
  topicLimit: number;
  pointsPerTopic: number;
  takeawayLimit: number;
  conceptLimit: number;
  keyTermLimit: number;
  numberLimit: number;
  warningLimit: number;
  procedureLimit: number;
  sectionLimit: number;
  factsPerSection: number;
}

const MODE_PROFILES: Record<SummaryMode, StudyNotesModeProfile> = {
  concise: {
    overviewLimit: 2,
    topicLimit: 5,
    pointsPerTopic: 4,
    takeawayLimit: 3,
    conceptLimit: 8,
    keyTermLimit: 6,
    numberLimit: 5,
    warningLimit: 4,
    procedureLimit: 5,
    sectionLimit: 6,
    factsPerSection: 2,
  },
  comprehensive: {
    overviewLimit: 3,
    topicLimit: 10,
    pointsPerTopic: 6,
    takeawayLimit: 5,
    conceptLimit: 16,
    keyTermLimit: 16,
    numberLimit: 12,
    warningLimit: 10,
    procedureLimit: 10,
    sectionLimit: 12,
    factsPerSection: 6,
  },
  exam: {
    overviewLimit: 2,
    topicLimit: 8,
    pointsPerTopic: 6,
    takeawayLimit: 5,
    conceptLimit: 12,
    keyTermLimit: 12,
    numberLimit: 10,
    warningLimit: 8,
    procedureLimit: 7,
    sectionLimit: 8,
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
  const supportedFacts = learningProfile.facts.filter(
    (fact) => fact.verificationStatus === "supported",
  );
  const cautionSectionIds = new Set(
    grounding.sections
      .filter((section) => isSummaryCautionHeading(section.heading))
      .map((section) => section.sectionId),
  );
  const isExplicitCautionFact = (fact: AtomicFact): boolean =>
    ["warning", "common_mistake", "limitation"].includes(fact.type);
  const uniqueSupportedFacts = uniqueFacts(
    supportedFacts.filter((fact) => learningProfile.rolesByFactId.get(fact.id) !== "example"),
  );
  const factsById = new Map(
    uniqueSupportedFacts.map((fact) => [fact.id, fact]),
  );
  const semanticMap = buildSemanticEvidenceMap({
    sections: learningProfile.sections,
    facts: uniqueSupportedFacts,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    documentTitle: profile?.title.value ?? fallbackTitle,
  });
  const summaryTopics = buildSummaryLearningTopics({
    sections: learningProfile.sections,
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
    uniqueSupportedFacts,
    modeProfile.overviewLimit,
    learningProfile.rolesByFactId,
    semanticMap,
  );
  const topicFacts = summaryTopics.flatMap((topic) => [
    topic.explanation,
    ...topic.keyPoints,
  ]);
  const reservedTakeawayKeys = new Set(
    [...overviewFacts, ...topicFacts].map((fact) => normalise(fact.content)),
  );
  const takeawayFacts = selectTakeawayFacts(
    uniqueSupportedFacts.filter(
      (fact) =>
        !reservedTakeawayKeys.has(normalise(fact.content)) &&
        isTakeawayFact(fact),
    ),
    modeProfile.takeawayLimit,
    semanticMap,
  );
  const numberFacts = selectFacts(
    uniqueSupportedFacts.filter(isMeaningfulSummaryNumberFact),
    ["result", "formula", "number"],
    modeProfile.numberLimit,
  );
  const sectionHeadingById = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );
  const warningFacts = selectFacts(
    uniqueSupportedFacts
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
  const summaryConcepts = selectSummaryConcepts(
    learningProfile.concepts,
    modeProfile.conceptLimit,
  );
  const importantConcepts = summaryConcepts.map((concept) => concept.name);
  const summaryKeyTerms = selectSummaryKeyTerms(
    learningProfile.keyTerms,
    modeProfile.keyTermLimit,
  );
  const title = cleanHeading(profile?.title.value ?? fallbackTitle);

  const render = (options: BuildMarkdownOptions): string => {
    const renderedTopics = renderLearningTopics(
      summaryTopics,
      options.factsPerSection,
      options.compactSections,
    );

    return [
      `# ${title}`,
      getStudyNotesVersionMarker(mode),
      "## Overview",
      renderOverviewList(overviewFacts, title),
      renderedTopics ? "## Study Topics" : "",
      renderedTopics,
      summaryKeyTerms.length > 0 ? "## Key Terms" : "",
      summaryKeyTerms
        .map((term) =>
          `- **${term.term}:** ${term.definition}${pageLabel(term.evidence[0]?.pageNumber)}`,
        )
        .join("\n"),
      numberFacts.length > 0 ? "## Important Numbers, Formulas and Results" : "",
      renderFactList(numberFacts),
      warningFacts.length > 0 ? "## Important Warnings and Notes" : "",
      renderWarningList(warningFacts),
      takeawayFacts.length > 0 ? "## Key Takeaways" : "",
      renderTakeawayList(takeawayFacts),
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

  const compatibilityKeyPoints = uniqueFacts(
    topicFacts.filter(
      (fact) =>
        !isExplicitCautionFact(fact) &&
        !cautionSectionIds.has(fact.sourceSectionId),
    ),
  ).map((fact) => fact.content);

  return {
    summary,
    keyPoints: compatibilityKeyPoints,
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
  const topicExplanations = [...topics]
    .sort((left, right) => right.score - left.score)
    .map((topic) => topic.explanation)
    .filter((fact) =>
      isSummaryHeadlineTextEligible(fact.content) &&
      isSummaryTopicPointUseful(fact.content) &&
      !/^(?:my|our|your|i|we|you|they|someone|there|this|that|these|those)\b/iu.test(
        fact.content.trim(),
      ),
    );

  if (topicExplanations.length > 0) {
    return uniqueFacts(topicExplanations).slice(0, limit);
  }

  return selectLearningDiverseFacts(
    fallbackFacts.filter((fact) => {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      return Boolean(
        unit?.explanationEligible &&
        !["metadata", "narrative", "transition", "exercise", "example"].includes(unit.role) &&
        !["procedure_step", "number", "warning", "common_mistake", "limitation"].includes(fact.type) &&
        isSummaryHeadlineTextEligible(fact.content)
      );
    }),
    limit,
    rolesByFactId,
  );
}

function renderOverviewList(facts: AtomicFact[], title: string): string {
  if (facts.length === 0) {
    return `- Focus: verified learning topics from ${title}.`;
  }

  return facts
    .map((fact) => `- ${formatOverviewFact(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
    .join("\n");
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
        "**Important key points:**",
        points,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
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
      `- ${fact.content}${includePage ? pageLabel(fact.evidence[0]?.pageNumber) : ""}`,
    )
    .join("\n");
}

function renderTakeawayList(facts: AtomicFact[]): string {
  return facts
    .map((fact) =>
      `- ${formatTakeaway(fact)}${pageLabel(fact.evidence[0]?.pageNumber)}`,
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

function selectDiverseFacts(
  facts: AtomicFact[],
  typePriority: AtomicFact["type"][],
  limit: number,
): AtomicFact[] {
  const ranked = selectFacts(facts, typePriority, facts.length);
  const selected: AtomicFact[] = [];
  const selectedIds = new Set<string>();
  const sectionCounts = new Map<string, number>();

  for (const fact of ranked) {
    if (sectionCounts.has(fact.sourceSectionId)) continue;

    selected.push(fact);
    selectedIds.add(fact.id);
    sectionCounts.set(fact.sourceSectionId, 1);

    if (selected.length >= limit) return selected;
  }

  for (const fact of ranked) {
    if (
      selectedIds.has(fact.id) ||
      (sectionCounts.get(fact.sourceSectionId) ?? 0) >= 2
    ) {
      continue;
    }

    selected.push(fact);
    sectionCounts.set(
      fact.sourceSectionId,
      (sectionCounts.get(fact.sourceSectionId) ?? 0) + 1,
    );
    if (selected.length >= limit) break;
  }

  return selected;
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

function selectTakeawayFacts(
  facts: AtomicFact[],
  limit: number,
  semanticMap: ReturnType<typeof buildSemanticEvidenceMap>,
): AtomicFact[] {
  return selectDiverseFacts(
    facts.filter((fact) => {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      return Boolean(
        unit?.pointEligible &&
        !["metadata", "narrative", "transition", "exercise", "example"].includes(unit.role) &&
        isTakeawayFact(fact)
      );
    }),
    [
      "objective",
      "rule",
      "relationship",
      "condition",
      "result",
      "definition",
      "claim",
    ],
    limit,
  );
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
    /^(?:i|we|my|our|you|your|they|someone|there|this\s+book|the\s+goal|the\s+questions?|let(?:'|’)s|now|then|later|eventually|notice|try|imagine|suppose)\b/iu.test(value)
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

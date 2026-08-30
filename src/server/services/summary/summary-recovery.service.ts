import type {
  AtomicFact,
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type {
  ReliableDocumentProfile,
} from "@/server/intelligence/reliability/types";
import {
  buildSemanticEvidenceMap,
} from "@/server/intelligence/semantic-evidence";
import {
  NOTE_RULES,
} from "@/server/entities/note.entity";
import {
  getStudyNotesVersionMarker,
  type GroundedStudyNotesResult,
} from "@/server/services/summary/grounded-study-notes.service";
import {
  isActionableSummaryWarningFact,
  selectSummaryConcepts,
  selectSummaryKeyTerms,
} from "@/server/services/summary/summary-learning-structure.service";
import {
  buildSummaryLearningTopics,
} from "@/server/services/summary/summary-topic-learning.service";
import {
  buildLearningEvidenceProfile,
} from "@/server/services/quality/learning-evidence.service";
import type {
  SummaryMode,
} from "@/types/summary";

interface RecoveryPolicy {
  topicLimit: number;
  pointsPerTopic: number;
  conceptLimit: number;
  keyTermLimit: number;
}

const RECOVERY_POLICIES: Record<SummaryMode, RecoveryPolicy> = {
  concise: {
    topicLimit: 4,
    pointsPerTopic: 3,
    conceptLimit: 8,
    keyTermLimit: 5,
  },
  comprehensive: {
    topicLimit: 10,
    pointsPerTopic: 4,
    conceptLimit: 14,
    keyTermLimit: 10,
  },
  exam: {
    topicLimit: 6,
    pointsPerTopic: 4,
    conceptLimit: 10,
    keyTermLimit: 8,
  },
};

/**
 * Conservative recovery for Summary v3.
 *
 * Recovery is allowed to be more extractive than the primary Summary path,
 * but it must not fall back to raw source layout. In particular, structural
 * headings (title, Abstract, Introduction, Results, etc.) and metadata cannot
 * become learner topics merely because they preserve source coverage.
 *
 * The recovery path therefore reuses the same semantic-evidence map and topic
 * contracts as normal generation. Coverage that does not belong in a topic
 * can still be preserved in the dedicated important-results block.
 */
export function buildGroundedSummaryRecovery(
  grounding: GroundedKnowledge,
  profile: ReliableDocumentProfile | null,
  fallbackTitle: string,
  mode: SummaryMode,
): GroundedStudyNotesResult {
  const policy = RECOVERY_POLICIES[mode];
  const learningProfile = buildLearningEvidenceProfile(grounding);
  const facts = uniqueFacts(
    learningProfile.facts.filter((fact) =>
      fact.verificationStatus === "supported" &&
      fact.content.trim().length > 0 &&
      learningProfile.rolesByFactId.get(fact.id) !== "example"
    ),
  );
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const recoverySections = learningProfile.sections.filter(
    (section) => !/^(?:common\s+mistakes?|warnings?|pitfalls?|limitations?|important\s+(?:practical\s+)?note)$/iu.test(
      cleanHeading(section.heading),
    ),
  );
  const recoveryFactIds = new Set(
    recoverySections.flatMap((section) => section.factIds),
  );
  const title = cleanHeading(profile?.title.value ?? fallbackTitle) || "Study Notes";
  const semanticMap = buildSemanticEvidenceMap({
    sections: recoverySections,
    facts,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    documentTitle: title,
  });

  // v3 recovery intentionally does not reconstruct one card per source
  // section. It uses the same semantic topic builder as normal generation so
  // source structure cannot bypass topic/explanation alignment contracts.
  const topics = buildSummaryLearningTopics({
    sections: recoverySections,
    factsById,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    rolesByFactId: learningProfile.rolesByFactId,
    semanticMap,
    mode,
    topicLimit: policy.topicLimit,
    pointsPerTopic: policy.pointsPerTopic,
    documentTitle: title,
  });

  const keyTerms = selectSummaryKeyTerms(
    learningProfile.keyTerms,
    policy.keyTermLimit,
  );
  const sectionHeadingById = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );
  const warnings = learningProfile.warningFacts
    .filter((fact) => factsById.has(fact.id) && recoveryFactIds.has(fact.id))
    .filter((fact) => {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      return Boolean(
        unit &&
        ["warning", "limitation"].includes(unit.role) &&
        isActionableSummaryWarningFact(
          fact,
          sectionHeadingById.get(fact.sourceSectionId) ?? "",
        )
      );
    })
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, mode === "concise" ? 3 : 6);
  const importantConcepts = selectSummaryConcepts(
    learningProfile.concepts,
    policy.conceptLimit,
  ).map((concept) => concept.name.trim());
  const importantResultFacts = selectImportantRecoveryResults(
    facts,
    semanticMap,
    mode === "concise" ? 3 : 6,
  );

  const render = (topicLimit: number, pointsPerTopic: number): string => {
    const visibleTopics = topics.slice(0, topicLimit);
    const overview = [...visibleTopics]
      .sort((left, right) => right.score - left.score)
      .slice(0, mode === "comprehensive" ? 3 : 2)
      .map((topic) => `- ${sentence(topic.explanation.content)}${pageLabel(topic.explanation.evidence[0]?.pageNumber)}`)
      .join("\n");
    const topicBlocks = visibleTopics
      .map((topic) => {
        const points = topic.keyPoints
          .slice(0, pointsPerTopic)
          .map((fact) => `- ${sentence(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
          .join("\n");
        return [
          `### ${topic.heading}`,
          `**Simple explanation:** ${sentence(topic.explanation.content)}${pageLabel(topic.explanation.evidence[0]?.pageNumber)}`,
          "**Important key points:**",
          points,
        ].filter(Boolean).join("\n");
      })
      .join("\n\n");
    const termBlock = keyTerms
      .map((term) => `- **${term.term}:** ${term.definition}${pageLabel(term.evidence[0]?.pageNumber)}`)
      .join("\n");
    const importantResultBlock = importantResultFacts
      .map((fact) => `- ${sentence(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
      .join("\n");
    const warningBlock = warnings
      .map((fact) => `- ${sentence(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
      .join("\n");
    const takeaways = uniqueFacts([
      ...visibleTopics.map((topic) => topic.explanation),
      ...importantResultFacts,
    ])
      .slice(-Math.min(5, visibleTopics.length + importantResultFacts.length))
      .map((fact) => `- ${sentence(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
      .join("\n");

    return [
      `# ${title}`,
      getStudyNotesVersionMarker(mode),
      "## Overview",
      overview || `- Focus: verified learning topics from ${title}.`,
      topicBlocks ? "## Study Topics" : "",
      topicBlocks,
      termBlock ? "## Key Terms" : "",
      termBlock,
      importantResultBlock ? "## Important Numbers, Formulas and Results" : "",
      importantResultBlock,
      warningBlock ? "## Important Warnings and Notes" : "",
      warningBlock,
      takeaways ? "## Key Takeaways" : "",
      takeaways,
    ].filter(Boolean).join("\n\n").trim();
  };

  let summary = render(policy.topicLimit, policy.pointsPerTopic);
  if (summary.length > NOTE_RULES.SUMMARY_MAX) {
    summary = render(Math.max(3, policy.topicLimit - 2), Math.max(2, policy.pointsPerTopic - 1));
  }
  if (summary.length > NOTE_RULES.SUMMARY_MAX) {
    summary = render(Math.max(2, policy.topicLimit - 4), 2);
  }
  if (summary.length > NOTE_RULES.SUMMARY_MAX) {
    summary = summary.slice(0, NOTE_RULES.SUMMARY_MAX).replace(/\s+\S*$/u, "").trim();
  }

  const keyPoints = uniqueFacts([
    ...topics.flatMap((topic) => [topic.explanation, ...topic.keyPoints]),
    ...importantResultFacts,
  ]).map((fact) => fact.content.trim());

  return {
    summary,
    keyPoints,
    importantConcepts,
    confidence: Math.min(grounding.quality.score, 0.84),
    status: "partial",
    profile,
  };
}

function selectImportantRecoveryResults(
  facts: AtomicFact[],
  semanticMap: ReturnType<typeof buildSemanticEvidenceMap>,
  limit: number,
): AtomicFact[] {
  return facts
    .filter((fact) => {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      if (!unit || !unit.pointEligible) return false;
      if (["metadata", "narrative", "transition", "exercise", "example"].includes(unit.role)) {
        return false;
      }
      return Boolean(
        unit.role === "finding" ||
        unit.role === "formula" ||
        fact.type === "result" ||
        fact.type === "number" ||
        /\b\d+(?:\.\d+)?\s*(?:%|percent|volt|volts|v\b|ms\b|s\b|seconds?|minutes?|hours?|projects?|samples?|cases?|users?|items?)\b/iu.test(fact.content)
      );
    })
    .sort((left, right) =>
      right.importanceScore - left.importanceScore ||
      right.confidence - left.confidence,
    )
    .slice(0, limit);
}

function uniqueFacts(facts: AtomicFact[]): AtomicFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = fact.content
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}%+.-]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#+\s*/u, "")
    .replace(/[\r\n]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sentence(value: string): string {
  const text = value.replace(/\s+/gu, " ").trim();
  return /[.!?]$/u.test(text) ? text : `${text}.`;
}

function pageLabel(page?: number): string {
  return page ? ` _(p. ${page})_` : "";
}

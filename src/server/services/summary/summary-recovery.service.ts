import type {
  AtomicFact,
  GroundedKnowledge,
  ImportantConcept,
  QualifiedTerm,
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
  isMeaningfulSummaryNumberFact,
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
  keyPointLimit: number;
  conceptLimit: number;
  keyTermLimit: number;
  procedureLimit: number;
  exampleLimit: number;
  warningLimit: number;
  numberLimit: number;
}

const RECOVERY_POLICIES: Record<SummaryMode, RecoveryPolicy> = {
  concise: {
    topicLimit: 4,
    pointsPerTopic: 3,
    keyPointLimit: 5,
    conceptLimit: 8,
    keyTermLimit: 5,
    procedureLimit: 4,
    exampleLimit: 2,
    warningLimit: 3,
    numberLimit: 3,
  },
  comprehensive: {
    topicLimit: 10,
    pointsPerTopic: 4,
    keyPointLimit: 8,
    conceptLimit: 14,
    keyTermLimit: 10,
    procedureLimit: 8,
    exampleLimit: 5,
    warningLimit: 6,
    numberLimit: 6,
  },
  exam: {
    topicLimit: 6,
    pointsPerTopic: 4,
    keyPointLimit: 8,
    conceptLimit: 10,
    keyTermLimit: 8,
    procedureLimit: 6,
    exampleLimit: 3,
    warningLimit: 6,
    numberLimit: 6,
  },
};

/**
 * Conservative recovery for Summary v3.2.
 *
 * Recovery remains more extractive than the primary Summary path, but it now
 * preserves the same learner-facing section contract. Structural source labels
 * still cannot become learner topics simply to increase source coverage.
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
  const procedureFacts = uniqueFacts(learningProfile.procedureFacts)
    .sort(bySourceOrder(grounding))
    .slice(0, policy.procedureLimit);
  const procedureIds = new Set(procedureFacts.map((fact) => fact.id));
  const topicFacts = facts.filter((fact) =>
    !procedureIds.has(fact.id) &&
    !["warning", "common_mistake", "limitation", "formula", "number"].includes(fact.type)
  );
  const factsById = new Map(topicFacts.map((fact) => [fact.id, fact]));
  const visibleFactIds = new Set(topicFacts.map((fact) => fact.id));
  const recoverySections = learningProfile.sections
    .filter(
      (section) => !/^(?:common\s+mistakes?|warnings?|pitfalls?|limitations?|important\s+(?:practical\s+)?note)$/iu.test(
        cleanHeading(section.heading),
      ),
    )
    .map((section) => ({
      ...section,
      factIds: section.factIds.filter((id) => visibleFactIds.has(id)),
    }))
    .filter((section) => section.factIds.length > 0);
  const title = cleanHeading(profile?.title.value ?? fallbackTitle) || "Study Notes";
  const semanticMap = buildSemanticEvidenceMap({
    sections: recoverySections,
    facts: topicFacts,
    concepts: learningProfile.concepts,
    keyTerms: learningProfile.keyTerms,
    documentTitle: title,
  });

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
  const concepts = selectSummaryConcepts(
    learningProfile.concepts,
    policy.conceptLimit,
  );
  const importantConcepts = concepts.map((concept) => concept.name.trim());
  const sectionHeadingById = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );
  const warnings = uniqueFacts(learningProfile.warningFacts)
    .filter((fact) =>
      isActionableSummaryWarningFact(
        fact,
        sectionHeadingById.get(fact.sourceSectionId) ?? "",
      ),
    )
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, policy.warningLimit);
  const importantResultFacts = selectImportantRecoveryResults(
    facts,
    policy.numberLimit,
  );
  const examples = uniqueFacts(learningProfile.exampleFacts)
    .filter((fact) => isUsefulExample(fact.content))
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, policy.exampleLimit);
  const keyPointFacts = selectRecoveryKeyPoints(
    topics.flatMap((topic) => [topic.explanation, ...topic.keyPoints]),
    policy.keyPointLimit,
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
          points ? "**Important details:**" : "",
          points,
        ].filter(Boolean).join("\n");
      })
      .join("\n\n");

    return [
      `# ${title}`,
      getStudyNotesVersionMarker(mode),
      "## Overview",
      overview || `- Focus: verified learning topics from ${title}.`,
      "## Key Points",
      renderFactList(keyPointFacts),
      "## Key Concepts",
      renderConceptList(concepts),
      "## Key Terms",
      renderKeyTermList(keyTerms),
      "## Detailed Study Notes",
      topicBlocks || renderFactList(keyPointFacts),
      procedureFacts.length > 0 ? "## Processes / Steps" : "",
      renderNumberedList(procedureFacts),
      examples.length > 0 ? "## Examples" : "",
      renderFactList(examples),
      warnings.length > 0 ? "## Warnings / Common Mistakes" : "",
      renderFactList(warnings),
      importantResultFacts.length > 0 ? "## Important Numbers / Formulas" : "",
      renderFactList(importantResultFacts),
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

  return {
    summary,
    keyPoints: keyPointFacts.map((fact) => fact.content.trim()),
    importantConcepts,
    confidence: Math.min(grounding.quality.score, 0.84),
    status: "partial",
    profile,
  };
}

function selectImportantRecoveryResults(
  facts: AtomicFact[],
  limit: number,
): AtomicFact[] {
  return uniqueFacts(facts)
    .filter((fact) => {
      if (fact.type === "formula") return true;
      const meaningfulNumericText =
        /\b\d+(?:\.\d+)?\s*%/u.test(fact.content) ||
        /\b\d+(?:\.\d+)?\s*(?:percent|volt|volts|v\b|ms\b|s\b|seconds?|minutes?|hours?|projects?|samples?|cases?|users?|items?)\b/iu.test(fact.content) ||
        /[=<>±×÷]/u.test(fact.content);
      if (fact.type === "number") return isMeaningfulSummaryNumberFact(fact);
      if (fact.type === "result") {
        return isMeaningfulSummaryNumberFact(fact) &&
          (fact.numericTokens.length > 0 || meaningfulNumericText);
      }
      return meaningfulNumericText;
    })
    .sort((left, right) =>
      right.importanceScore - left.importanceScore ||
      right.confidence - left.confidence,
    )
    .slice(0, limit);
}

function selectRecoveryKeyPoints(
  facts: AtomicFact[],
  limit: number,
): AtomicFact[] {
  return uniqueFacts(facts)
    .filter((fact) =>
      !["procedure_step", "example", "warning", "common_mistake", "limitation", "formula", "number"].includes(fact.type)
    )
    .sort((left, right) => right.importanceScore - left.importanceScore)
    .slice(0, limit);
}

function renderConceptList(concepts: ImportantConcept[]): string {
  if (concepts.length === 0) return "";
  return concepts
    .map((concept) => {
      const explanation = concept.explanation?.trim();
      return `- **${concept.name}**${explanation ? `: ${sentence(explanation)}` : ""}${pageLabel(concept.evidence[0]?.pageNumber)}`;
    })
    .join("\n");
}

function renderKeyTermList(terms: QualifiedTerm[]): string {
  if (terms.length === 0) return "";
  return terms
    .map((term) => `- **${term.term}:** ${sentence(term.definition)}${pageLabel(term.evidence[0]?.pageNumber)}`)
    .join("\n");
}

function renderFactList(facts: AtomicFact[]): string {
  if (facts.length === 0) return "";
  return facts
    .map((fact) => `- ${sentence(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
    .join("\n");
}

function renderNumberedList(facts: AtomicFact[]): string {
  return facts
    .map((fact, index) => `${index + 1}. ${sentence(fact.content)}${pageLabel(fact.evidence[0]?.pageNumber)}`)
    .join("\n");
}

function isUsefulExample(value: string): boolean {
  const text = value.replace(/\s+/gu, " ").trim();
  return (
    text.length >= 24 &&
    text.length <= 420 &&
    !text.endsWith("?") &&
    !/^(?:i|we|you|my|our|let(?:'|’)s|imagine|suppose|write|answer)\b/iu.test(text)
  );
}

function bySourceOrder(grounding: GroundedKnowledge) {
  const order = new Map(
    grounding.sections.map((section, index) => [section.sectionId, index]),
  );
  return (left: AtomicFact, right: AtomicFact): number =>
    (order.get(left.sourceSectionId) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.sourceSectionId) ?? Number.MAX_SAFE_INTEGER) ||
    right.importanceScore - left.importanceScore;
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

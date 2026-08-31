import type {
  AtomicFact,
  ImportantConcept,
  QualifiedTerm,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import {
  canonicalStudyConceptKey,
} from "@/server/intelligence/pipeline/source-hygiene";
import type {
  SemanticEvidenceMap,
  SemanticEvidenceUnit,
} from "@/server/intelligence/semantic-evidence";
import {
  isStructuralSemanticHeading,
  semanticEvidenceExplanationFit,
  semanticEvidencePointFit,
  semanticRoleTopicLabel,
  semanticTextOverlap,
  semanticTopicTextAlignment,
} from "@/server/intelligence/semantic-evidence";
import {
  factLearningUtilityScore,
  type LearningEvidenceRole,
} from "@/server/services/quality/learning-evidence.service";
import {
  isSummaryCandidateTextEligible,
  isSummaryCautionHeading,
  isSummaryFactEligible,
  isSummaryReferenceHeading,
} from "@/server/services/summary/summary-learning-structure.service";
import type { SummaryMode } from "@/types/summary";

export interface SummaryLearningTopic {
  heading: string;
  explanation: AtomicFact;
  keyPoints: AtomicFact[];
  sourceSectionIds: string[];
  score: number;
  sourceOrder: number;
}

interface BuildSummaryTopicsInput {
  sections: SectionCoverage[];
  factsById: Map<string, AtomicFact>;
  concepts: ImportantConcept[];
  keyTerms: QualifiedTerm[];
  rolesByFactId: Map<string, LearningEvidenceRole>;
  semanticMap: SemanticEvidenceMap;
  mode: SummaryMode;
  topicLimit: number;
  pointsPerTopic: number;
  documentTitle?: string;
}

interface TopicDraft {
  heading: string;
  sourceSectionIds: string[];
  facts: AtomicFact[];
  sourceOrder: number;
  lastSourceOrder: number;
  score: number;
  kind: "topic" | "framework" | "procedure";
}

interface HeadingCandidate {
  value: string;
  kind: "source" | "concept" | "term" | "definition";
  anchorScore: number;
}

const PRACTICE_HEADING_RE = /\b(?:reflection|chapter\s+challenge|challenge|exercise|activity|worksheet|practice\s+questions?|review\s+questions?|quiz|write\s+your\s+answers?|mentor(?:'s)?\s+note)\b/iu;
const STRUCTURAL_HEADING_RE = /^(?:introduction|overview|summary|conclusion|learning\s+objectives?|objectives?|chapter\s+goal|chapter\s+takeaway|key\s+takeaways?|takeaways?|before\s+we\s+begin|a\s+note\s+before\s+we\s+begin|why\s+i\s+wrote\s+this\s+book|how\s+to\s+use\s+this\s+book|think|observation|object|discovery|the\s+big\s+idea|final\s+summary)$/iu;
const FRAMEWORK_COMPONENT_RE = /^[A-Z]\s*[–—-]\s+(.+)$/u;
const NUMBERED_PREFIX_RE = /^(?:(?:chapter|section|part|discovery)\s+\d+(?:\.\d+)*\s*[:.\-–—]?\s*|\d+(?:\.\d+)*\s*[:.\-–—]?\s*)/iu;
const DISCOVERING_PREFIX_RE = /^discover(?:ing|y)?\s+/iu;
const QUESTION_PREFIX_RE = /^(?:why|how|what|where|when)\s+/iu;
const NON_TOPIC_LABEL_RE = /^(?:n|t|h|i|k|d|s|c|o|v|e|both|there|name|address|value|step|stage|test|phase|part|example|question|answer|my\s+goal|the\s+questions?|the\s+emphasis|the\s+strategy|since\s+the\s+entire\s+book|continue\s+until\s+there)$/iu;
const NARRATIVE_START_RE = /^(?:i|we|you|my|our|your|they|someone|there|this|that|these|those|both|since)\b/iu;
const QUESTION_OR_PROMPT_RE = /(?:\?$|(?:\.{3}|…)$)|^(?:q\s*[:;]|write\b|answer\b|imagine\b|suppose\b|think\b|did\s+you\b|do\s+you\b|can\s+you\b|why\b|how\b|what\b|when\b|where\b)/iu;
const FIRST_PERSON_NARRATIVE_RE = /^(?:i|we|my|our|someone|there)\b/iu;
const LOW_VALUE_POINT_START_RE = /^(?:let(?:'|’)s\b|now\b|then\b|later\b|eventually\b|next\b|notice\b|remember\b|try\b|close\b|pause\b|imagine\b|suppose\b|write\b|answer\b|add\b|move\b|look\b|compare\b|you\b|we\b|i\b|someone\b|rather\s+than\b|in\s+the\s+next\b)/iu;
const PRONOUN_FRAGMENT_RE = /^(?:it|this|that|these|those|they|them|he|she)\b/iu;
const INSTRUCTIONAL_HEADING_RE = /^(?:learn|remember|try|practice|write|answer|ask|imagine|look|think)\b/iu;
// Some legitimate learner topics are pedagogical principles whose headings are
// intentionally concise imperatives (for example, "Know Your Audience") and
// therefore may share few literal words with their explanatory sentence.
// These are distinct from exercise/task fragments and may use their own
// section evidence when the evidence is otherwise high-utility and grounded.
const PEDAGOGICAL_PRINCIPLE_HEADING_RE = /^(?:know|show|explain|use|invite|tell|be|keep|avoid|prefer|understand|confirm|connect|communicate|present|validate|verify|prioriti[sz]e)\b/iu;
const FRAGMENT_HEADING_RE = /^(?:[-–—>→↓]+\s*)|(?:\b(?:move|place|put|go|click|select|open|add|edit|save)\b.*\b(?:before|after|to|into|on|off)\b)/iu;
const DISCOURSE_HEADING_RE = /^(?:although|however|therefore|thus|even\s+in|even\s+when|instead|otherwise|meanwhile|because|since|while|when|then|next|finally|also|moreover|furthermore)\b/iu;
const INCOMPLETE_HEADING_TAIL_RE = /\b(?:it|this|that|these|those|a|an|the|of|to|for|with|by|from|in|on|and|or|but)\s*$/iu;
const SENTENCE_LIKE_HEADING_RE = /^(?:every|all|most|many|some|few|there|this|that|these|those)\b.*\b(?:is|are|was|were|has|have|contains?|begins?|includes?|shows?|means?|allows?|requires?|uses?)\b/iu;
const LOW_VALUE_SOURCE_TOPIC_RE = /^(?:data\s+from\b|many\s+of\b|some\s+of\b|a\s+number\s+of\b|toolset\s+provided\s+by\b|contents?\s+of\b|remainder\s+of\b|.+\s+in\s+(?:figure|table|chart|diagram)\s*\d+\b|(?:one|two|three|several|many|few)\s+(?:probabilit(?:y|ies)|values?|things?|items?|forms?|types?|ways?|steps?)\b)/iu;
const SOURCE_NAVIGATION_POINT_RE = /^(?:the\s+contents?\s+of\s+(?:the\s+)?(?:remainder|rest)|the\s+remainder\s+of\s+the\s+(?:paper|chapter)|in\s+(?:section|chapter)\s+\d+)\b/iu;
const PREDICATE_RE = /\b(?:is|are|means?|refers?\s+to|uses?|needs?|requires?|allows?|prevents?|contains?|includes?|represents?|stores?|changes?|repeats?|returns?|receives?|performs?|guides?|helps?|explains?|shows?|connects?|translates?|converts?|selects?|compares?|solves?|provides?|organizes?|organises?)\b/iu;
const STRONG_FACT_TYPES = new Set<AtomicFact["type"]>([
  "definition",
  "rule",
  "relationship",
  "objective",
  "condition",
  "result",
  "formula",
]);
const EXPLANATION_TYPE_PRIORITY: AtomicFact["type"][] = [
  "definition",
  "relationship",
  "rule",
  "objective",
  "condition",
  "result",
  "claim",
  "formula",
  "number",
  "procedure_step",
];

export function buildSummaryLearningTopics(
  input: BuildSummaryTopicsInput,
): SummaryLearningTopic[] {
  const drafts: TopicDraft[] = [];
  const byKey = new Map<string, TopicDraft>();
  let activeFramework: TopicDraft | null = null;
  let activeProcedure: TopicDraft | null = null;

  input.sections.forEach((section, sourceOrder) => {
    const rawHeading = cleanHeading(section.heading);
    const semanticSectionRole = input.semanticMap.sectionRoleById.get(section.sectionId) ?? "content";

    if (
      section.status !== "covered" ||
      ["metadata", "reference", "practice", "caution"].includes(semanticSectionRole) ||
      isSummaryReferenceHeading(section.heading) ||
      isSummaryCautionHeading(section.heading) ||
      PRACTICE_HEADING_RE.test(rawHeading)
    ) {
      activeFramework = null;
      activeProcedure = null;
      return;
    }

    if (STRUCTURAL_HEADING_RE.test(rawHeading)) {
      // Structural headings are not learner topics by themselves, but their
      // facts may contain real definitions or concepts. Reset grouping state
      // and let semantic anchors inside the section choose the topic label.
      activeFramework = null;
      activeProcedure = null;
    }

    const facts = uniqueFacts(
      section.factIds
        .map((id) => input.factsById.get(id))
        .filter((fact): fact is AtomicFact => Boolean(fact))
        .filter((fact) => isTopicFactEligible(fact, section, input.semanticMap)),
    );
    if (facts.length === 0) return;

    const semanticFrameworkParent = input.semanticMap.frameworkParentBySectionId.get(section.sectionId);
    if (semanticFrameworkParent && semanticFrameworkParent !== section.sectionId) {
      const group = input.semanticMap.frameworks.find(
        (item) => item.parentSectionId === semanticFrameworkParent,
      );
      if (group) {
        const key = canonicalTopicKey(group.name);
        let frameworkDraft = byKey.get(key);
        if (!frameworkDraft) {
          frameworkDraft = {
            heading: normaliseTopicHeading(group.name),
            sourceSectionIds: [semanticFrameworkParent],
            facts: [],
            sourceOrder: group.sourceOrder,
            lastSourceOrder: sourceOrder,
            score: 0,
            kind: "framework",
          };
          byKey.set(key, frameworkDraft);
          drafts.push(frameworkDraft);
        }
        mergeDraft(frameworkDraft, section.sectionId, facts, sourceOrder);
        activeFramework = frameworkDraft;
        activeProcedure = null;
        return;
      }
    }

    const frameworkComponent = rawHeading.match(FRAMEWORK_COMPONENT_RE);
    const explicitStep = /^(?:step|stage|test|phase|part)\s*\d+\b/iu.test(rawHeading);

    if (
      activeFramework &&
      shouldMergeIntoFramework(
        activeFramework,
        rawHeading,
        facts,
        sourceOrder,
        input.concepts,
        input.keyTerms,
        section.sectionId,
      )
    ) {
      mergeDraft(activeFramework, section.sectionId, facts, sourceOrder);
      return;
    }

    if (frameworkComponent && activeFramework) {
      mergeDraft(activeFramework, section.sectionId, facts, sourceOrder);
      return;
    }

    if (explicitStep) {
      if (!activeProcedure) {
        activeProcedure = {
          heading: "Process and Procedure",
          sourceSectionIds: [],
          facts: [],
          sourceOrder,
          lastSourceOrder: sourceOrder,
          score: 0,
          kind: "procedure",
        };
        drafts.push(activeProcedure);
        byKey.set(canonicalTopicKey(activeProcedure.heading), activeProcedure);
      }
      mergeDraft(activeProcedure, section.sectionId, facts, sourceOrder);
      return;
    }

    const procedureLike = facts.every((fact) => fact.type === "procedure_step") ||
      /\b(?:process|procedure|workflow|configuration|configure|setup|testing|verification|framework|method)\b/iu.test(rawHeading);

    const heading = chooseTopicHeading(
      section,
      facts,
      input.concepts,
      input.keyTerms,
      input.rolesByFactId,
      input.semanticMap,
      input.documentTitle,
    );

    if (!heading) {
      if (procedureLike && activeProcedure) {
        mergeDraft(activeProcedure, section.sectionId, facts, sourceOrder);
      }
      return;
    }

    const key = canonicalTopicKey(heading);
    if (!key) return;

    let draft = byKey.get(key);
    if (!draft) {
      draft = {
        heading,
        sourceSectionIds: [],
        facts: [],
        sourceOrder,
        lastSourceOrder: sourceOrder,
        score: 0,
        kind: /\bframework\b/iu.test(heading)
          ? "framework"
          : procedureLike
            ? "procedure"
            : "topic",
      };
      byKey.set(key, draft);
      drafts.push(draft);
    }
    mergeDraft(draft, section.sectionId, facts, sourceOrder);

    if (draft.kind === "framework") {
      activeFramework = draft;
    } else if (!frameworkComponent) {
      activeFramework = null;
    }

    if (draft.kind === "procedure") {
      activeProcedure = draft;
    } else if (!facts.some((fact) => fact.type === "procedure_step")) {
      activeProcedure = null;
    }
  });

  addSemanticAnchorDrafts({
    drafts,
    byKey,
    sections: input.sections,
    factsById: input.factsById,
    concepts: input.concepts,
    keyTerms: input.keyTerms,
    semanticMap: input.semanticMap,
    documentTitle: input.documentTitle,
  });

  addRoleBasedSemanticDrafts({
    drafts,
    byKey,
    semanticMap: input.semanticMap,
    documentTitle: input.documentTitle,
  });

  // A source section can mention several concepts, but one grounded fact
  // should not be copied into every nearby topic. Assign reusable evidence to
  // the topic(s) it actually explains best before card construction.
  allocateDraftFactsToBestTopics(drafts, input.semanticMap);

  const coherentDrafts = drafts
    .map((draft) => ({ ...draft, facts: uniqueFacts(draft.facts) }))
    .filter((draft) => draftIsSemanticallyCoherent(draft, input.semanticMap))
    .map((draft) => ({
      ...draft,
      score: topicScore(draft, input.rolesByFactId, input.mode),
    }));

  // Rank every plausible draft first, but do not consume the learner-facing
  // topic budget until after semantic validation. Previously we sliced here,
  // so rejected high-ranked drafts could starve valid lower-ranked topics and
  // leave Comprehensive mode with only a few cards.
  const rankedCandidates = coherentDrafts
    .filter((draft) => {
      if (draft.facts.length >= 2 || hasStrongCoreFact(draft.facts)) {
        return true;
      }

      // Pedagogical principles are often expressed as one concise sentence
      // under a meaningful heading (for example, a presentation principle).
      // Do not discard those solely because the source section is short.
      if (
        draft.kind === "topic" &&
        PEDAGOGICAL_PRINCIPLE_HEADING_RE.test(draft.heading)
      ) {
        return draft.facts.some((fact) => {
          const role = input.rolesByFactId.get(fact.id) ?? "supporting";
          return factLearningUtilityScore(fact, role) >= 0.72;
        });
      }

      return false;
    })
    .sort((left, right) => right.score - left.score);

  const topics = rankedCandidates.map((draft): SummaryLearningTopic | null => {
    const explanation = selectExplanation(
      draft.heading,
      draft.facts,
      input.rolesByFactId,
      input.semanticMap,
      draft.kind,
    );
    if (!explanation) return null;

    const keyPoints = draft.kind === "framework"
      ? selectFrameworkKeyPoints(
          draft,
          explanation,
          input.rolesByFactId,
          input.semanticMap,
          input.pointsPerTopic,
          input.mode,
        )
      : selectTopicKeyPoints(
          draft.heading,
          explanation,
          draft.facts.filter((fact) => fact.id !== explanation.id),
          input.rolesByFactId,
          input.semanticMap,
          input.pointsPerTopic,
          input.mode,
          draft.kind === "procedure",
        );

    const explanationUnit = input.semanticMap.unitsByFactId.get(explanation.id);
    if (!explanationUnit) return null;
    const localPedagogicalRelation =
      draft.kind === "topic" &&
      PEDAGOGICAL_PRINCIPLE_HEADING_RE.test(draft.heading) &&
      draft.sourceSectionIds.includes(explanation.sourceSectionId);
    const explanationFit = semanticEvidenceExplanationFit({
      heading: draft.heading,
      unit: explanationUnit,
      kind: draft.kind,
      localPedagogicalRelation,
    });
    if (!explanationFit.passed) return null;

    return {
      heading: draft.heading,
      explanation,
      keyPoints,
      sourceSectionIds: draft.sourceSectionIds,
      score: draft.score,
      sourceOrder: draft.sourceOrder,
    };
  }).filter((topic): topic is SummaryLearningTopic => Boolean(topic));

  // Spend the mode budget only on topics that survived all semantic gates,
  // then restore source order for a natural reading flow.
  return selectCoverageAwareTopics(
    mergeNearDuplicateTopics(topics),
    input.semanticMap,
    input.topicLimit,
  ).sort((left, right) => left.sourceOrder - right.sourceOrder);
}

interface SemanticAnchorDraftInput {
  drafts: TopicDraft[];
  byKey: Map<string, TopicDraft>;
  sections: SectionCoverage[];
  factsById: Map<string, AtomicFact>;
  concepts: ImportantConcept[];
  keyTerms: QualifiedTerm[];
  semanticMap: SemanticEvidenceMap;
  documentTitle?: string;
}

function addSemanticAnchorDrafts(input: SemanticAnchorDraftInput): void {
  const sourceOrderBySectionId = new Map(
    input.sections.map((section, index) => [section.sectionId, index]),
  );
  const sectionById = new Map(
    input.sections.map((section) => [section.sectionId, section]),
  );
  const titleKey = input.documentTitle
    ? canonicalTopicKey(input.documentTitle)
    : "";

  const addAnchor = (
    headingValue: string,
    sectionIds: string[],
    explanationHint: string | null,
    importance: number,
  ): void => {
    const heading = normaliseTopicHeading(headingValue);
    const key = canonicalTopicKey(heading);
    if (
      !key ||
      !isSummaryTopicHeadingEligible(heading) ||
      (titleKey && key === titleKey)
    ) {
      return;
    }

    const facts = uniqueFacts(
      sectionIds
        .flatMap((sectionId) => {
          const section = sectionById.get(sectionId);
          if (!section || section.status !== "covered") return [];
          return section.factIds
            .map((factId) => input.factsById.get(factId))
            .filter((fact): fact is AtomicFact => Boolean(fact))
            .filter((fact) => isTopicFactEligible(fact, section, input.semanticMap));
        })
        .filter((fact) => {
          const headingAlignment = summaryTopicTextAlignment(
            heading,
            fact.content,
          );
          const explanationAlignment = explanationHint
            ? semanticTextOverlap(explanationHint, fact.content)
            : 0;
          const unit = input.semanticMap.unitsByFactId.get(fact.id);
          if (!unit || !unit.explanationEligible) return false;
          return headingAlignment >= 0.12 || explanationAlignment >= 0.22;
        }),
    );

    if (facts.length === 0) return;

    const sourceOrder = sectionIds.reduce(
      (best, sectionId) => Math.min(
        best,
        sourceOrderBySectionId.get(sectionId) ?? Number.MAX_SAFE_INTEGER,
      ),
      Number.MAX_SAFE_INTEGER,
    );
    if (!Number.isFinite(sourceOrder) || sourceOrder === Number.MAX_SAFE_INTEGER) {
      return;
    }

    const existing = input.byKey.get(key);
    if (existing) {
      for (const sectionId of sectionIds) {
        const sectionFacts = facts.filter(
          (fact) => fact.sourceSectionId === sectionId,
        );
        if (sectionFacts.length > 0) {
          mergeDraft(existing, sectionId, sectionFacts, sourceOrder);
        }
      }
      existing.score = Math.max(existing.score, importance);
      return;
    }

    const draft: TopicDraft = {
      heading,
      sourceSectionIds: [...new Set(sectionIds)],
      facts,
      sourceOrder,
      lastSourceOrder: sourceOrder,
      score: importance,
      kind: "topic",
    };
    input.byKey.set(key, draft);
    input.drafts.push(draft);
  };

  for (const concept of [...input.concepts]
    .sort((left, right) => right.importanceScore - left.importanceScore)) {
    addAnchor(
      concept.name,
      concept.sourceSectionIds,
      concept.explanation,
      concept.importanceScore,
    );
  }

  const conceptKeys = new Set(
    input.concepts.map((concept) => canonicalTopicKey(concept.name)),
  );
  for (const term of [...input.keyTerms]
    .filter((item) => item.confidence >= 0.78)
    .sort((left, right) => right.confidence - left.confidence)) {
    if (conceptKeys.has(canonicalTopicKey(term.term))) continue;
    addAnchor(
      term.term,
      [term.sourceSectionId],
      term.definition,
      term.confidence,
    );
  }
}

interface RoleBasedSemanticDraftInput {
  drafts: TopicDraft[];
  byKey: Map<string, TopicDraft>;
  semanticMap: SemanticEvidenceMap;
  documentTitle?: string;
}

function addRoleBasedSemanticDrafts(input: RoleBasedSemanticDraftInput): void {
  const titleKey = input.documentTitle ? canonicalTopicKey(input.documentTitle) : "";
  const groups = new Map<string, { heading: string; regionId: string; units: SemanticEvidenceUnit[] }>();

  for (const unit of input.semanticMap.units) {
    if (!unit.explanationEligible || unit.learningUtility < 0.74) continue;
    if (!["method", "finding", "cause_effect", "objective"].includes(unit.role)) continue;
    const heading = semanticRoleTopicLabel(unit.role);
    if (!heading) continue;
    const key = `${unit.regionId}:${canonicalTopicKey(heading)}`;
    const group = groups.get(key) ?? { heading, regionId: unit.regionId, units: [] };
    group.units.push(unit);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const heading = normaliseTopicHeading(group.heading);
    const key = canonicalTopicKey(heading);
    if (!key || key === titleKey) continue;
    const facts = uniqueFacts(group.units.map((unit) => unit.fact));
    if (facts.length === 0) continue;
    const sourceOrder = Math.min(...group.units.map((unit) => unit.sourceOrder));
    const lastSourceOrder = Math.max(...group.units.map((unit) => unit.sourceOrder));
    const sectionIds = [...new Set(group.units.map((unit) => unit.sectionId))];

    // A semantic role (for example, research findings) can occur in several
    // source regions. Merge those grounded units into the same learner topic
    // instead of letting the first region suppress later evidence. Coverage
    // selection can then account for every contributing source section.
    const existing = input.byKey.get(key);
    if (existing) {
      existing.facts = uniqueFacts([...existing.facts, ...facts]);
      existing.sourceSectionIds = [...new Set([
        ...existing.sourceSectionIds,
        ...sectionIds,
      ])];
      existing.sourceOrder = Math.min(existing.sourceOrder, sourceOrder);
      existing.lastSourceOrder = Math.max(existing.lastSourceOrder, lastSourceOrder);
      existing.score = Math.max(
        existing.score,
        ...group.units.map((unit) => unit.learningUtility),
      );
      continue;
    }

    const draft: TopicDraft = {
      heading,
      sourceSectionIds: sectionIds,
      facts,
      sourceOrder,
      lastSourceOrder,
      score: Math.max(...group.units.map((unit) => unit.learningUtility)),
      kind: "topic",
    };
    input.byKey.set(key, draft);
    input.drafts.push(draft);
  }
}

function allocateDraftFactsToBestTopics(
  drafts: TopicDraft[],
  semanticMap: SemanticEvidenceMap,
): void {
  const ownersByFactId = new Map<string, Array<{ draft: TopicDraft; score: number }>>();

  for (const draft of drafts) {
    if (draft.kind !== "topic") continue;
    for (const fact of uniqueFacts(draft.facts)) {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      if (!unit) continue;
      const fit = semanticEvidenceExplanationFit({
        heading: draft.heading,
        unit,
        kind: "topic",
        localPedagogicalRelation:
          PEDAGOGICAL_PRINCIPLE_HEADING_RE.test(draft.heading) &&
          draft.sourceSectionIds.includes(fact.sourceSectionId),
      });
      const score = fit.score + summaryTopicTextAlignment(draft.heading, fact.content) * 0.25;
      const list = ownersByFactId.get(fact.id) ?? [];
      list.push({ draft, score });
      ownersByFactId.set(fact.id, list);
    }
  }

  for (const [factId, owners] of ownersByFactId) {
    if (owners.length <= 1) continue;
    owners.sort((left, right) => right.score - left.score);
    const allowed = new Set(
      owners.slice(0, 1).map((owner) => owner.draft),
    );
    for (const owner of owners) {
      if (allowed.has(owner.draft)) continue;
      owner.draft.facts = owner.draft.facts.filter((fact) => fact.id !== factId);
    }
  }
}

function selectCoverageAwareTopics(
  topics: SummaryLearningTopic[],
  semanticMap: SemanticEvidenceMap,
  limit: number,
): SummaryLearningTopic[] {
  if (topics.length <= limit) return topics;
  const ranked = [...topics].sort((left, right) => right.score - left.score);
  const selected: SummaryLearningTopic[] = [];
  const selectedHeadings = new Set<string>();
  const regionForTopic = (topic: SummaryLearningTopic): string => {
    for (const sectionId of topic.sourceSectionIds) {
      const region = semanticMap.regionBySectionId.get(sectionId);
      if (region) return region;
    }
    return "region-0";
  };

  const candidateRegions = semanticMap.regions
    .filter((region) => region.evidenceCount > 0)
    .sort((left, right) => right.evidenceCount - left.evidenceCount);
  const regionBudget = Math.min(candidateRegions.length, Math.max(2, Math.ceil(limit * 0.5)));

  for (const region of candidateRegions.slice(0, regionBudget)) {
    const candidate = ranked.find((topic) =>
      regionForTopic(topic) === region.id && !selectedHeadings.has(canonicalTopicKey(topic.heading)),
    );
    if (!candidate) continue;
    selected.push(candidate);
    selectedHeadings.add(canonicalTopicKey(candidate.heading));
    if (selected.length >= limit) return selected;
  }

  for (const topic of ranked) {
    const key = canonicalTopicKey(topic.heading);
    if (selectedHeadings.has(key)) continue;
    selected.push(topic);
    selectedHeadings.add(key);
    if (selected.length >= limit) break;
  }
  return selected;
}

function chooseTopicHeading(
  section: SectionCoverage,
  facts: AtomicFact[],
  concepts: ImportantConcept[],
  keyTerms: QualifiedTerm[],
  rolesByFactId: Map<string, LearningEvidenceRole>,
  semanticMap: SemanticEvidenceMap,
  documentTitle?: string,
): string | null {
  const cleaned = normaliseTopicHeading(section.heading);
  const titleKey = documentTitle ? canonicalTopicKey(documentTitle) : "";
  const candidates: HeadingCandidate[] = [];

  const sectionConcepts = concepts
    .filter((item) => item.sourceSectionIds.includes(section.sectionId))
    .filter((item) => isSummaryTopicHeadingEligible(item.name));
  const sectionTerms = keyTerms
    .filter((item) => item.sourceSectionId === section.sectionId)
    .filter((item) => isSummaryTopicHeadingEligible(item.term));
  const definitionLabels = facts
    .filter((fact) => fact.type === "definition")
    .map((fact) => definitionSubject(fact.content))
    .filter((value): value is string => Boolean(value && isSummaryTopicHeadingEligible(value)));

  const semanticAnchorKeys = new Set([
    ...sectionConcepts.map((item) => canonicalTopicKey(item.name)),
    ...sectionTerms.map((item) => canonicalTopicKey(item.term)),
    ...definitionLabels.map(canonicalTopicKey),
  ].filter(Boolean));

  const semanticSectionRole = semanticMap.sectionRoleById.get(section.sectionId) ?? "content";
  if (
    cleaned &&
    semanticSectionRole !== "structural" &&
    semanticSectionRole !== "metadata" &&
    isSummaryTopicHeadingEligible(cleaned) &&
    (!titleKey || canonicalTopicKey(cleaned) !== titleKey)
  ) {
    const alignment = maxFactAlignment(cleaned, facts);
    const sourceBacked = semanticAnchorKeys.has(canonicalTopicKey(cleaned));
    const strongAlignedFact = facts.some((fact) =>
      STRONG_FACT_TYPES.has(fact.type) &&
      summaryTopicTextAlignment(cleaned, fact.content) >= 0.45,
    );
    const frameworkOrProcedure = /\b(?:framework|process|procedure|workflow|method)\b/iu.test(cleaned);

    if (
      !LOW_VALUE_SOURCE_TOPIC_RE.test(cleaned) &&
      (sourceBacked || strongAlignedFact || frameworkOrProcedure)
    ) {
      candidates.push({
        value: cleaned,
        kind: "source",
        anchorScore: alignment + (sourceBacked ? 0.22 : 0) +
          (strongAlignedFact ? 0.16 : 0),
      });
    } else {
      // A clean pedagogical source heading may express the learner-facing
      // meaning with different words than its supporting facts. Keep it as a
      // low-priority fallback even when noisy concept/term candidates exist.
      // Strong semantic anchors still outrank this fallback, so example/task
      // headings such as "Largest Number" continue to collapse into concepts
      // such as "Algorithm" when the evidence supports that interpretation.
      const bestUtility = facts.reduce((best, fact) => {
        const role = rolesByFactId.get(fact.id) ?? "supporting";
        return Math.max(best, factLearningUtilityScore(fact, role));
      }, 0);
      const usefulFactCount = facts.filter((fact) =>
        isSummaryTopicPointUseful(fact.content, { allowProcedure: fact.type === "procedure_step" }),
      ).length;

      if (
        PEDAGOGICAL_PRINCIPLE_HEADING_RE.test(cleaned) &&
        bestUtility >= 0.72 &&
        usefulFactCount > 0
      ) {
        candidates.push({
          value: cleaned,
          kind: "source",
          anchorScore: 0.20 + Math.min(0.28, bestUtility * 0.20),
        });
      }
    }
  }

  for (const concept of sectionConcepts) {
    candidates.push({
      value: cleanHeading(concept.name),
      kind: "concept",
      anchorScore:
        maxFactAlignment(concept.name, facts) +
        Math.min(0.25, concept.importanceScore * 0.2),
    });
  }

  for (const term of sectionTerms) {
    candidates.push({
      value: cleanHeading(term.term),
      kind: "term",
      anchorScore:
        maxFactAlignment(term.term, facts) +
        Math.min(0.22, term.confidence * 0.18),
    });
  }

  for (const label of definitionLabels) {
    candidates.push({
      value: cleanHeading(label),
      kind: "definition",
      anchorScore: maxFactAlignment(label, facts) + 0.24,
    });
  }

  const ranked = dedupeHeadingCandidates(candidates)
    .filter((candidate) => {
      const alignment = maxFactAlignment(candidate.value, facts);
      if (/\b(?:framework|process|procedure|workflow|method)\b/iu.test(candidate.value)) {
        return true;
      }
      return candidate.kind === "source"
        ? alignment >= 0.18 || candidate.anchorScore >= 0.30
        : alignment >= 0.10 || candidate.anchorScore >= 0.30;
    })
    .sort((left, right) => {
      const roleBoost = (candidate: HeadingCandidate): number => {
        const matchingFacts = facts.filter((fact) =>
          summaryTopicTextAlignment(candidate.value, fact.content) >= 0.2,
        );
        return matchingFacts.reduce((best, fact) => {
          const role = rolesByFactId.get(fact.id) ?? "supporting";
          return Math.max(best, factLearningUtilityScore(fact, role));
        }, 0);
      };
      return (
        right.anchorScore + roleBoost(right) * 0.15 -
        (left.anchorScore + roleBoost(left) * 0.15)
      );
    });

  return ranked[0] ? normaliseTopicHeading(ranked[0].value) : null;
}

export function isSummaryTopicHeadingEligible(value: string): boolean {
  const heading = normaliseTopicHeading(value);
  const words = heading.split(/\s+/u).filter(Boolean);
  if (!heading || words.length === 0 || words.length > 9) return false;
  if (heading.length < 3 || heading.length > 84) return false;
  if (isStructuralSemanticHeading(heading)) return false;
  if (DISCOURSE_HEADING_RE.test(heading)) return false;
  if (INCOMPLETE_HEADING_TAIL_RE.test(heading)) return false;
  if (SENTENCE_LIKE_HEADING_RE.test(heading)) return false;
  if (LOW_VALUE_SOURCE_TOPIC_RE.test(heading)) return false;
  if (STRUCTURAL_HEADING_RE.test(heading) || PRACTICE_HEADING_RE.test(heading)) return false;
  if (NON_TOPIC_LABEL_RE.test(heading)) return false;
  if (/^q\s*[:;]/iu.test(heading) || /[.!:]$/u.test(heading)) return false;
  if (FRAGMENT_HEADING_RE.test(heading)) return false;
  if (INSTRUCTIONAL_HEADING_RE.test(heading) && words.length >= 3) return false;
  if (NARRATIVE_START_RE.test(heading) && words.length >= 3) return false;
  return /\p{L}/u.test(heading);
}

export function isSummaryTopicPointUseful(
  value: string,
  options: { allowProcedure?: boolean } = {},
): boolean {
  const text = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!text || text.length < 18 || text.endsWith(":")) return false;
  if (!isSummaryCandidateTextEligible(text)) return false;
  if (QUESTION_OR_PROMPT_RE.test(text)) return false;
  if (SOURCE_NAVIGATION_POINT_RE.test(text)) return false;
  if (FIRST_PERSON_NARRATIVE_RE.test(text)) return false;
  if (PRONOUN_FRAGMENT_RE.test(text)) return false;
  if (LOW_VALUE_POINT_START_RE.test(text)) {
    if (!options.allowProcedure || !/^(?:add|assign|change|check|click|compare|connect|create|disable|enable|enter|open|select|choose|configure|verify|calculate|repeat|return|send|store|set|test|update|identify|define|inspect|solve|capture|organize|organise|express)\b/iu.test(text)) {
      return false;
    }
  }
  if (/^(?:may\s+be|maybe|yes|no|easy|probably|congratulations|notice\s+something)\b/iu.test(text)) {
    return false;
  }
  if (!PREDICATE_RE.test(text) && text.split(/\s+/u).length < 7) return false;
  return true;
}

export function summaryTopicTextAlignment(
  headingValue: string,
  textValue: string,
): number {
  return semanticTopicTextAlignment(headingValue, textValue);
}

function isTopicFactEligible(
  fact: AtomicFact,
  section: SectionCoverage,
  semanticMap: SemanticEvidenceMap,
): boolean {
  const text = fact.content.trim();
  const unit = semanticMap.unitsByFactId.get(fact.id);
  if (!unit || (!unit.pointEligible && !unit.explanationEligible)) return false;
  if (!isSummaryFactEligible(fact, section)) return false;
  if (!isSummaryCandidateTextEligible(text)) return false;
  if (text.length < 16 || text.endsWith(":")) return false;
  if (!isSummaryTopicPointUseful(text, { allowProcedure: fact.type === "procedure_step" })) return false;
  return true;
}

function normaliseTopicHeading(value: string): string {
  let heading = cleanHeading(value)
    .replace(NUMBERED_PREFIX_RE, "")
    .replace(DISCOVERING_PREFIX_RE, "")
    .replace(/^(?:the|a|an)\s+(?=\p{L}{3,})/iu, "")
    .trim();

  if (QUESTION_PREFIX_RE.test(heading)) {
    heading = heading.replace(/\?$/u, "").trim();
  }

  if (/^\p{Ll}/u.test(heading)) {
    heading = heading.charAt(0).toLocaleUpperCase() + heading.slice(1);
  }

  return heading;
}

function canonicalTopicKey(value: string): string {
  return canonicalStudyConceptKey(
    normaliseTopicHeading(value)
      .replace(/\b(?:the|a|an|chapter|topic)\b/giu, " ")
      .replace(/\b(?:framework|process|procedure)\b/giu, (match) => match.toLocaleLowerCase())
      .replace(/\s+/gu, " ")
      .trim(),
  );
}

function mergeDraft(
  draft: TopicDraft,
  sectionId: string,
  facts: AtomicFact[],
  sourceOrder: number,
): void {
  if (!draft.sourceSectionIds.includes(sectionId)) {
    draft.sourceSectionIds.push(sectionId);
  }
  draft.facts.push(...facts);
  draft.lastSourceOrder = Math.max(draft.lastSourceOrder, sourceOrder);
}

function shouldMergeIntoFramework(
  draft: TopicDraft,
  rawHeading: string,
  facts: AtomicFact[],
  sourceOrder: number,
  concepts: ImportantConcept[],
  keyTerms: QualifiedTerm[],
  sectionId: string,
): boolean {
  if (draft.kind !== "framework" || sourceOrder - draft.lastSourceOrder > 6) return false;
  if (FRAMEWORK_COMPONENT_RE.test(rawHeading)) return true;

  const normalizedHeading = normaliseTopicHeading(rawHeading);
  const words = normalizedHeading.split(/\s+/u).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  const frameworkComponentSignal =
    /^(?:understand|identify|name|keep|define|inspect|solve|capture|organize|organise|verify|express|human)\b/iu.test(normalizedHeading) ||
    facts.some((fact) =>
      /\b(?:framework|guiding\s+question|questions?|steps?|repeat|process)\b/iu.test(fact.content),
    );
  const hasDefinitionAnchor = facts.some((fact) =>
    fact.type === "definition" && Boolean(definitionSubject(fact.content)),
  );

  if (frameworkComponentSignal && !hasDefinitionAnchor) return true;

  const hasIndependentSemanticAnchor =
    concepts.some((concept) =>
      concept.sourceSectionIds.includes(sectionId) &&
      isSummaryTopicHeadingEligible(concept.name) &&
      maxFactAlignment(concept.name, facts) >= 0.35,
    ) ||
    keyTerms.some((term) =>
      term.sourceSectionId === sectionId &&
      isSummaryTopicHeadingEligible(term.term) &&
      maxFactAlignment(term.term, facts) >= 0.35,
    ) ||
    facts.some((fact) =>
      fact.type === "definition" &&
      Boolean(definitionSubject(fact.content)),
    );

  if (hasIndependentSemanticAnchor) return false;

  return facts.every((fact) =>
    ["procedure_step", "objective", "claim", "rule"].includes(fact.type),
  );
}

function draftIsSemanticallyCoherent(
  draft: TopicDraft,
  semanticMap: SemanticEvidenceMap,
): boolean {
  if (!isSummaryTopicHeadingEligible(draft.heading)) return false;
  if (draft.kind !== "topic") return draft.facts.length > 0;

  return draft.facts.some((fact) => {
    const unit = semanticMap.unitsByFactId.get(fact.id);
    if (!unit) return false;
    return semanticEvidenceExplanationFit({
      heading: draft.heading,
      unit,
      kind: "topic",
      localPedagogicalRelation:
        PEDAGOGICAL_PRINCIPLE_HEADING_RE.test(draft.heading) &&
        draft.sourceSectionIds.includes(fact.sourceSectionId),
    }).passed;
  });
}

function topicScore(
  draft: TopicDraft,
  rolesByFactId: Map<string, LearningEvidenceRole>,
  mode: SummaryMode,
): number {
  const factScores = draft.facts
    .map((fact) => {
      const role = rolesByFactId.get(fact.id) ?? "supporting";
      let score = factLearningUtilityScore(fact, role);
      if (mode === "exam" && ["definition", "rule", "condition", "formula", "result", "warning"].includes(fact.type)) {
        score += 0.12;
      }
      const alignment = summaryTopicTextAlignment(draft.heading, fact.content);
      return score + alignment * 0.22;
    })
    .sort((a, b) => b - a);
  const top = factScores.slice(0, 4);
  const average = top.reduce((sum, value) => sum + value, 0) / Math.max(1, top.length);
  const depthBonus = Math.min(0.18, Math.max(0, draft.facts.length - 1) * 0.035);
  const frameworkBonus = draft.kind === "framework" ? 0.10 : 0;
  const coherenceBonus = Math.min(0.18, averageFactAlignment(draft.heading, draft.facts) * 0.18);
  return average + depthBonus + frameworkBonus + coherenceBonus;
}

function selectExplanation(
  heading: string,
  facts: AtomicFact[],
  rolesByFactId: Map<string, LearningEvidenceRole>,
  semanticMap: SemanticEvidenceMap,
  kind: TopicDraft["kind"],
): AtomicFact | null {
  const typeRank = new Map(EXPLANATION_TYPE_PRIORITY.map((type, index) => [type, index]));
  const candidates = facts
    .map((fact) => ({ fact, unit: semanticMap.unitsByFactId.get(fact.id) }))
    .filter((item): item is { fact: AtomicFact; unit: SemanticEvidenceUnit } => Boolean(item.unit))
    .filter(({ fact }) => isSummaryTopicPointUseful(fact.content, { allowProcedure: kind !== "topic" }))
    .map(({ fact, unit }) => {
      const localPedagogicalRelation =
        kind === "topic" &&
        PEDAGOGICAL_PRINCIPLE_HEADING_RE.test(heading);
      const fit = semanticEvidenceExplanationFit({
        heading,
        unit,
        kind,
        localPedagogicalRelation,
      });
      const role = rolesByFactId.get(fact.id) ?? "supporting";
      const typeValue = 1 - Math.min(1, (typeRank.get(fact.type) ?? 99) / 10);
      return {
        fact,
        fit,
        score: fit.score * 0.72 + factLearningUtilityScore(fact, role) * 0.20 + typeValue * 0.08,
      };
    })
    .filter(({ fit }) => fit.passed)
    .sort((left, right) => right.score - left.score || left.fact.content.length - right.fact.content.length);

  return candidates[0]?.fact ?? null;
}

function selectTopicKeyPoints(
  heading: string,
  explanation: AtomicFact,
  facts: AtomicFact[],
  rolesByFactId: Map<string, LearningEvidenceRole>,
  semanticMap: SemanticEvidenceMap,
  limit: number,
  mode: SummaryMode,
  allowProcedure: boolean,
): AtomicFact[] {
  return [...facts]
    .filter((fact) => !["warning", "common_mistake", "limitation"].includes(fact.type))
    .filter((fact) => isSummaryTopicPointUseful(fact.content, { allowProcedure }))
    .filter((fact) => {
      const unit = semanticMap.unitsByFactId.get(fact.id);
      const explanationUnit = semanticMap.unitsByFactId.get(explanation.id);
      if (!unit || !explanationUnit) return false;
      return semanticEvidencePointFit({
        heading,
        explanation: explanationUnit,
        unit,
        kind: allowProcedure ? "procedure" : "topic",
      }).passed;
    })
    .sort((left, right) => {
      const leftRole = rolesByFactId.get(left.id) ?? "supporting";
      const rightRole = rolesByFactId.get(right.id) ?? "supporting";
      const leftExam = mode === "exam" && ["definition", "rule", "condition", "formula", "result"].includes(left.type) ? 0.12 : 0;
      const rightExam = mode === "exam" && ["definition", "rule", "condition", "formula", "result"].includes(right.type) ? 0.12 : 0;
      const leftAlignment = Math.max(
        summaryTopicTextAlignment(heading, left.content),
        semanticTextOverlap(explanation.content, left.content),
      );
      const rightAlignment = Math.max(
        summaryTopicTextAlignment(heading, right.content),
        semanticTextOverlap(explanation.content, right.content),
      );
      return (
        factLearningUtilityScore(right, rightRole) + rightExam + rightAlignment * 0.18 -
        (factLearningUtilityScore(left, leftRole) + leftExam + leftAlignment * 0.18)
      );
    })
    .slice(0, limit);
}

function selectFrameworkKeyPoints(
  draft: TopicDraft,
  explanation: AtomicFact,
  rolesByFactId: Map<string, LearningEvidenceRole>,
  semanticMap: SemanticEvidenceMap,
  limit: number,
  mode: SummaryMode,
): AtomicFact[] {
  const candidates = draft.facts
    .filter((fact) => fact.id !== explanation.id)
    .filter((fact) => !["warning", "common_mistake", "limitation"].includes(fact.type))
    .filter((fact) => isSummaryTopicPointUseful(fact.content, { allowProcedure: true }));
  const ordered: AtomicFact[] = [];
  const seenSections = new Set<string>();

  for (const fact of candidates) {
    if (seenSections.has(fact.sourceSectionId)) continue;
    seenSections.add(fact.sourceSectionId);
    ordered.push(fact);
  }

  const frameworkLimit = Math.min(8, Math.max(limit, draft.sourceSectionIds.length));
  if (ordered.length >= frameworkLimit) return ordered.slice(0, frameworkLimit);

  const remainder = selectTopicKeyPoints(
    draft.heading,
    explanation,
    candidates.filter((fact) => !ordered.some((item) => item.id === fact.id)),
    rolesByFactId,
    semanticMap,
    frameworkLimit - ordered.length,
    mode,
    true,
  );

  return [...ordered, ...remainder].slice(0, frameworkLimit);
}

function hasStrongCoreFact(facts: AtomicFact[]): boolean {
  return facts.some((fact) =>
    (
      ["definition", "rule", "relationship", "objective", "result", "formula"].includes(fact.type) &&
      fact.importanceScore >= 0.84
    ) || fact.importanceScore >= 0.9,
  );
}

function definitionSubject(value: string): string | null {
  const match = value.trim().match(/^(.{3,70}?)\s+(?:is|are|means|refers\s+to)\s+/iu);
  if (!match?.[1]) return null;
  return cleanHeading(match[1]);
}

function maxFactAlignment(heading: string, facts: AtomicFact[]): number {
  return facts.reduce(
    (best, fact) => Math.max(best, summaryTopicTextAlignment(heading, fact.content)),
    0,
  );
}

function averageFactAlignment(heading: string, facts: AtomicFact[]): number {
  if (facts.length === 0) return 0;
  const values = facts.map((fact) => summaryTopicTextAlignment(heading, fact.content));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}



function dedupeHeadingCandidates(candidates: HeadingCandidate[]): HeadingCandidate[] {
  const byKey = new Map<string, HeadingCandidate>();
  for (const candidate of candidates) {
    const key = canonicalTopicKey(candidate.value);
    if (!key) continue;
    const previous = byKey.get(key);
    if (!previous || candidate.anchorScore > previous.anchorScore) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
}

function mergeNearDuplicateTopics(topics: SummaryLearningTopic[]): SummaryLearningTopic[] {
  const output: SummaryLearningTopic[] = [];

  for (const topic of topics) {
    const existing = output.find((candidate) => {
      const left = canonicalTopicKey(candidate.heading);
      const right = canonicalTopicKey(topic.heading);
      if (!left || !right) return false;
      // Canonical equality already collapses articles, aliases and common
      // singular/plural variants. Do not merge merely because one meaningful
      // concept contains another: "Bayesian Network" and
      // "Dynamic Bayesian Network" are related but distinct learner topics.
      return left === right;
    });

    if (!existing) {
      output.push(topic);
      continue;
    }

    existing.sourceSectionIds = [...new Set([
      ...existing.sourceSectionIds,
      ...topic.sourceSectionIds,
    ])];
    existing.keyPoints = uniqueFacts([
      ...existing.keyPoints,
      topic.explanation,
      ...topic.keyPoints,
    ]).slice(0, 8);
    existing.score = Math.max(existing.score, topic.score);
    existing.sourceOrder = Math.min(existing.sourceOrder, topic.sourceOrder);
  }

  return output.sort((left, right) => left.sourceOrder - right.sourceOrder);
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
    .replace(/[?]+$/u, "")
    .trim();
}

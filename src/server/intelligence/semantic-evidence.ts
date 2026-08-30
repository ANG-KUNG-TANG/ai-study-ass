import type {
  AtomicFact,
  ImportantConcept,
  QualifiedTerm,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import {
  canonicalStudyConceptKey,
} from "@/server/intelligence/pipeline/source-hygiene";

export type SemanticEvidenceRole =
  | "definition"
  | "principle"
  | "mechanism"
  | "cause_effect"
  | "method"
  | "finding"
  | "objective"
  | "procedure"
  | "framework_component"
  | "formula"
  | "warning"
  | "limitation"
  | "example"
  | "exercise"
  | "metadata"
  | "narrative"
  | "transition"
  | "supporting";

export type SemanticSectionRole =
  | "content"
  | "structural"
  | "metadata"
  | "practice"
  | "reference"
  | "caution"
  | "framework"
  | "procedure";

export interface SemanticEvidenceUnit {
  fact: AtomicFact;
  factId: string;
  sectionId: string;
  sectionHeading: string;
  sectionRole: SemanticSectionRole;
  role: SemanticEvidenceRole;
  sourceOrder: number;
  regionId: string;
  learningUtility: number;
  explanationEligible: boolean;
  pointEligible: boolean;
  conceptLabels: string[];
  termLabels: string[];
}

export interface SemanticFrameworkGroup {
  id: string;
  name: string;
  parentSectionId: string;
  componentSectionIds: string[];
  sourceOrder: number;
}

export interface SemanticRegion {
  id: string;
  sectionIds: string[];
  sourceOrder: number;
  evidenceCount: number;
}

export interface SemanticEvidenceMap {
  units: SemanticEvidenceUnit[];
  unitsByFactId: Map<string, SemanticEvidenceUnit>;
  sectionRoleById: Map<string, SemanticSectionRole>;
  regionBySectionId: Map<string, string>;
  regions: SemanticRegion[];
  frameworks: SemanticFrameworkGroup[];
  frameworkParentBySectionId: Map<string, string>;
  documentTitle?: string;
}

export interface BuildSemanticEvidenceMapInput {
  sections: SectionCoverage[];
  facts: AtomicFact[];
  concepts: ImportantConcept[];
  keyTerms: QualifiedTerm[];
  documentTitle?: string;
}

const STRUCTURAL_HEADING_RE = /^(?:abstract|introduction|overview|background|summary|conclusion|conclusions|discussion|methodology|methods?|results?|references?|bibliography|learning\s+objectives?|objectives?|chapter\s+goal|chapter\s+takeaway|key\s+takeaways?|takeaways?|why\s+i\s+wrote\s+this\s+book|how\s+to\s+use\s+this\s+book|before\s+we\s+begin|a\s+note\s+before\s+we\s+begin|final\s+summary)$/iu;
const REFERENCE_HEADING_RE = /^(?:references?|bibliography|works\s+cited|further\s+reading|appendix(?:\s+[a-z0-9]+)?|student\s+presentation\s+template|slide\s+\d+\b.*)$/iu;
const METADATA_HEADING_RE = /^(?:title|authors?|affiliations?|document\s+information|cover|front\s+matter|project\s+name|team\s+members?)$/iu;
const PRACTICE_HEADING_RE = /\b(?:reflection|challenge|exercise|activity|worksheet|practice\s+questions?|review\s+questions?|quiz|chapter\s+challenge|mentor(?:'s)?\s+note)\b/iu;
const CAUTION_HEADING_RE = /^(?:common\s+mistakes?(?:\s+students?\s+make)?|warnings?|pitfalls?|limitations?|important\s+(?:practical\s+)?note)$/iu;
const FRAMEWORK_HEADING_RE = /\b(?:framework|taxonomy|model\s+framework)\b/iu;
const PROCEDURE_HEADING_RE = /^(?:step|stage|phase|part)\s*\d+\b|\b(?:procedure|workflow|configuration|setup|verification\s+process)\b/iu;
const NUMBERED_PREFIX_RE = /^(?:(?:chapter|section|part)\s+\d+(?:\.\d+)*\s*[:.\-–—]?\s*|\d+(?:\.\d+)*\s*[:.\-–—]?\s*)/iu;
const TOP_LEVEL_NUMBER_RE = /^(?:chapter|part)\s+(\d+)\b|^(\d+)(?:\.|\s)/iu;
const MAJOR_STRUCTURAL_REGION_RE = /^(?:abstract|introduction|background|methodology|methods?|results?|discussion|conclusions?|validation|application\s+methodology)$/iu;
const FRAMEWORK_COMPONENT_LABEL_RE = /^(?:[A-Z]|[A-Z]\s*[–—-]\s+.+)$/u;
const META_TEXT_RE = /^(?:authors?|affiliations?|course|student|lecturer|instructor|teacher|project\s+name|team\s+members?|date)\s*:/iu;
const AFFILIATION_RE = /\b(?:university|institute|department|faculty|school\s+of|ltd\.?|limited|inc\.?|corporation|company|laboratory|lab\b)\b/iu;
const TRANSITION_RE = /^(?:in\s+this\s+(?:section|chapter|paper)|the\s+(?:remainder|rest)\s+of\s+(?:this\s+)?(?:paper|chapter)|the\s+next\s+section|we\s+(?:then|next)\s+(?:describe|show|present|discuss)|this\s+paper\s+is\s+organized)/iu;
const NAVIGATION_TEXT_RE = /\b(?:described|discussed|shown|presented|covered|introduced|explained)(?:\s+in\s+detail)?\s+(?:in|by)\s+(?:section|chapter|figure|table|page)\s*\d+/iu;
const EXERCISE_RE = /(?:\?$)|^(?:try|write|answer|calculate|count|imagine|suppose|practice|solve\s+this|your\s+turn|close\s+this\s+book|now\s+try)\b/iu;
const FIRST_PERSON_RE = /^(?:i|my|we|our)\b/iu;
const METHOD_RE = /\b(?:approach|method|methodology|model\s+was\s+built|built\s+using|we\s+use|we\s+used|uses?\s+.+\s+to|combine[sd]?|incorporat(?:e|es|ed)|calibrat(?:e|es|ed)|validation\s+method|trial\s+used|data\s+was\s+collected)\b/iu;
const FINDING_RE = /\b(?:result|results|found|showed|shows|demonstrated|achieved|correlation|accuracy|inaccuracy|improvement|outperformed|confirmed|validation\s+confirm|significant)\b/iu;
const CAUSAL_RE = /\b(?:cause|causes|causal|effect|affects?|influences?|increases?|decreases?|reduces?|depends?\s+on|determines?|leads?\s+to|results?\s+in|because|therefore)\b/iu;
const MECHANISM_RE = /\b(?:works?\s+by|process|translates?|converts?|maps?|stores?|updates?|passes?|links?|connects?|represents?|uses?\s+.+\s+to|allows?\s+.+\s+to)\b/iu;
const PRINCIPLE_RE = /\b(?:should|must|must\s+not|should\s+not|avoid|never|always|required|prefer(?:red)?|only\s+when|rule|principle)\b/iu;
const WARNING_RE = /\b(?:warning|avoid|do\s+not|don'?t|never|invalid|incorrect|pitfall|common\s+mistake)\b/iu;
const LIMITATION_RE = /\b(?:limitation|limited\s+to|cannot|can't|does\s+not\s+support|unsupported|constraint)\b/iu;
const PREDICATE_RE = /\b(?:is|are|means?|refers?\s+to|uses?|requires?|allows?|contains?|includes?|represents?|stores?|changes?|depends?|determines?|influences?|predicts?|models?|combines?|provides?|shows?|finds?|reduces?|increases?)\b/iu;
const GENERIC_STRUCTURE_TOKEN_RE = /^(?:abstract|introduction|overview|background|summary|conclusion|discussion|methodology|method|results?|references?)$/iu;
const TOPIC_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "in", "into", "is", "it", "of", "on", "or", "the", "their",
  "this", "to", "what", "when", "where", "why", "with", "your", "chapter",
  "section", "topic",
  // Generic academic/technical container words are weak evidence of semantic
  // identity. Without this guard, labels such as "Causal Model" and
  // "Phase Model" can appear aligned merely because both contain "model".
  "model", "models", "system", "systems", "process", "processes",
  "method", "methods", "approach", "approaches", "software", "project",
  "projects", "paper", "document",
]);

const FORMULA_EVIDENCE_RE = /(?:[\p{L}\p{N})]\s*=\s*[\p{L}\p{N}(]|\b(?:P|B|TNormal)\s*\([^)]*\)|[+\-*/^]\s*\p{N})/u;

export function buildSemanticEvidenceMap(
  input: BuildSemanticEvidenceMapInput,
): SemanticEvidenceMap {
  const factsById = new Map(input.facts.map((fact) => [fact.id, fact]));
  const sectionRoleById = new Map<string, SemanticSectionRole>();
  const regionBySectionId = buildRegionAssignments(input.sections);

  input.sections.forEach((section) => {
    sectionRoleById.set(
      section.sectionId,
      classifySemanticSection(section.heading, input.documentTitle),
    );
  });

  const conceptLabelsBySection = collectConceptLabels(input.concepts);
  const termLabelsBySection = collectTermLabels(input.keyTerms);
  const units: SemanticEvidenceUnit[] = [];

  input.sections.forEach((section, sourceOrder) => {
    const sectionRole = sectionRoleById.get(section.sectionId) ?? "content";
    const regionId = regionBySectionId.get(section.sectionId) ?? "region-0";

    for (const factId of section.factIds) {
      const fact = factsById.get(factId);
      if (!fact) continue;

      const role = classifySemanticEvidenceRole(
        fact,
        section,
        sectionRole,
      );
      const unit: SemanticEvidenceUnit = {
        fact,
        factId: fact.id,
        sectionId: section.sectionId,
        sectionHeading: section.heading,
        sectionRole,
        role,
        sourceOrder,
        regionId,
        learningUtility: semanticLearningUtility(fact, role),
        explanationEligible: semanticRoleAllowsExplanation(role),
        pointEligible: semanticRoleAllowsPoint(role),
        conceptLabels: labelsAnchoredToFact(
          conceptLabelsBySection.get(section.sectionId) ?? [],
          fact.content,
        ),
        termLabels: labelsAnchoredToFact(
          termLabelsBySection.get(section.sectionId) ?? [],
          fact.content,
        ),
      };
      units.push(unit);
    }
  });

  const unitsByFactId = new Map(units.map((unit) => [unit.factId, unit]));
  const frameworks = detectFrameworkGroups(
    input.sections,
    unitsByFactId,
    sectionRoleById,
  );
  const frameworkParentBySectionId = new Map<string, string>();

  for (const framework of frameworks) {
    frameworkParentBySectionId.set(
      framework.parentSectionId,
      framework.parentSectionId,
    );
    for (const sectionId of framework.componentSectionIds) {
      frameworkParentBySectionId.set(sectionId, framework.parentSectionId);
      for (const unit of units) {
        if (unit.sectionId === sectionId && unit.pointEligible) {
          unit.role = "framework_component";
          unit.explanationEligible = false;
          unit.pointEligible = true;
          unit.learningUtility += 0.08;
        }
      }
    }
  }

  const regions = summariseRegions(input.sections, units, regionBySectionId);

  return {
    units,
    unitsByFactId,
    sectionRoleById,
    regionBySectionId,
    regions,
    frameworks,
    frameworkParentBySectionId,
    documentTitle: input.documentTitle,
  };
}

export function classifySemanticSection(
  value: string,
  documentTitle?: string,
): SemanticSectionRole {
  const heading = normaliseHeading(value);
  const semanticHeading = stripNumbering(heading);
  const headingKey = canonicalStudyConceptKey(semanticHeading);
  const titleKey = documentTitle
    ? canonicalStudyConceptKey(normaliseHeading(documentTitle))
    : "";

  if (!heading) return "structural";
  if (titleKey && headingKey === titleKey) return "metadata";
  if (REFERENCE_HEADING_RE.test(semanticHeading)) return "reference";
  if (METADATA_HEADING_RE.test(semanticHeading)) return "metadata";
  if (PRACTICE_HEADING_RE.test(semanticHeading)) return "practice";
  if (CAUTION_HEADING_RE.test(semanticHeading)) return "caution";
  if (FRAMEWORK_HEADING_RE.test(semanticHeading)) return "framework";
  if (PROCEDURE_HEADING_RE.test(semanticHeading)) return "procedure";
  if (STRUCTURAL_HEADING_RE.test(semanticHeading)) return "structural";
  return "content";
}

export function classifySemanticEvidenceRole(
  fact: AtomicFact,
  _section: SectionCoverage,
  sectionRole: SemanticSectionRole,
): SemanticEvidenceRole {
  const text = cleanText(fact.content);

  if (!text) return "transition";
  if (looksLikeMetadata(text, sectionRole)) return "metadata";
  if (sectionRole === "practice" && EXERCISE_RE.test(text)) return "exercise";
  if (fact.type === "example") return "example";
  if (fact.type === "warning" || fact.type === "common_mistake" || WARNING_RE.test(text)) {
    return "warning";
  }
  if (fact.type === "limitation" || LIMITATION_RE.test(text)) return "limitation";
  if (fact.type === "procedure_step") return "procedure";
  // Some extractors label any sentence containing the word "formula" as a
  // formula. Require actual mathematical structure before granting the
  // high-utility formula role; prose about a formula language remains prose.
  if (fact.type === "formula" && FORMULA_EVIDENCE_RE.test(text)) return "formula";
  if (fact.type === "definition") return "definition";
  if (fact.type === "objective") return "objective";
  if (NAVIGATION_TEXT_RE.test(text)) return "transition";
  if (fact.type === "result" || (fact.type === "number" && FINDING_RE.test(text))) {
    return "finding";
  }
  if (TRANSITION_RE.test(text)) return "transition";
  if (FINDING_RE.test(text) && fact.importanceScore >= 0.72) return "finding";
  if (METHOD_RE.test(text)) return "method";
  if (CAUSAL_RE.test(text)) return "cause_effect";
  if (fact.type === "relationship" || MECHANISM_RE.test(text)) return "mechanism";
  if (fact.type === "rule" || fact.type === "condition" || PRINCIPLE_RE.test(text)) {
    return "principle";
  }
  if (EXERCISE_RE.test(text)) return "exercise";
  if (FIRST_PERSON_RE.test(text) && !PREDICATE_RE.test(text)) return "narrative";
  if (FIRST_PERSON_RE.test(text) && fact.importanceScore < 0.88) return "narrative";
  return "supporting";
}

export function semanticRoleAllowsExplanation(
  role: SemanticEvidenceRole,
): boolean {
  return [
    "definition",
    "principle",
    "mechanism",
    "cause_effect",
    "method",
    "finding",
    "objective",
    "formula",
    "supporting",
  ].includes(role);
}

export function semanticRoleAllowsPoint(
  role: SemanticEvidenceRole,
): boolean {
  return ![
    "metadata",
    "narrative",
    "transition",
    "exercise",
    "example",
  ].includes(role);
}

export function semanticLearningUtility(
  fact: AtomicFact,
  role: SemanticEvidenceRole,
): number {
  const roleBoost: Record<SemanticEvidenceRole, number> = {
    definition: 0.20,
    principle: 0.16,
    mechanism: 0.15,
    cause_effect: 0.17,
    method: 0.16,
    finding: 0.19,
    objective: 0.12,
    procedure: 0.10,
    framework_component: 0.14,
    formula: 0.17,
    warning: 0.12,
    limitation: 0.10,
    supporting: 0.02,
    example: -0.12,
    exercise: -0.30,
    metadata: -0.55,
    narrative: -0.22,
    transition: -0.35,
  };
  const length = cleanText(fact.content).length;
  const standaloneBoost = PREDICATE_RE.test(fact.content) ? 0.05 : 0;
  const shortPenalty = length < 24 ? 0.10 : 0;
  return fact.importanceScore + fact.confidence * 0.06 + roleBoost[role] + standaloneBoost - shortPenalty;
}

export function semanticTopicTextAlignment(
  headingValue: string,
  textValue: string,
): number {
  const heading = stripNumbering(normaliseHeading(headingValue));
  const text = cleanText(textValue);
  if (!heading || !text) return 0;

  const headingKey = canonicalStudyConceptKey(heading);
  const textKey = canonicalStudyConceptKey(text);
  if (headingKey && textKey.includes(headingKey)) return 1;

  const headingTokens = meaningfulTokens(heading);
  const textTokens = meaningfulTokens(text);
  if (headingTokens.size === 0 || textTokens.size === 0) return 0;

  let matched = 0;
  for (const token of headingTokens) {
    if ([...textTokens].some((item) => stemsMatch(token, item))) matched += 1;
  }

  const headingCoverage = matched / headingTokens.size;
  const reverseMatches = [...textTokens].filter((token) =>
    [...headingTokens].some((item) => stemsMatch(item, token)),
  ).length;
  const textCoverage = reverseMatches / Math.max(1, Math.min(textTokens.size, 8));
  return Math.min(1, headingCoverage * 0.82 + textCoverage * 0.18);
}

export function semanticTextOverlap(left: string, right: string): number {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let matched = 0;
  for (const token of leftTokens) {
    if ([...rightTokens].some((item) => stemsMatch(token, item))) matched += 1;
  }
  return matched / Math.min(leftTokens.size, Math.max(1, rightTokens.size));
}

export function semanticEvidenceTopicAlignment(
  heading: string,
  unit: SemanticEvidenceUnit,
): number {
  let score = semanticTopicTextAlignment(heading, unit.fact.content);
  const roleTopicLabel = semanticRoleTopicLabel(unit.role);
  if (
    roleTopicLabel &&
    canonicalStudyConceptKey(roleTopicLabel) === canonicalStudyConceptKey(heading)
  ) {
    // Role-derived topics deliberately summarize semantically equivalent
    // evidence whose wording may never contain the synthetic learner label
    // itself (for example, a 95% correlation statement under
    // "Results and Findings"). The evidence role is the anchor.
    score = Math.max(score, 0.92);
  }
  for (const label of [...unit.conceptLabels, ...unit.termLabels]) {
    score = Math.max(score, semanticTopicTextAlignment(heading, label));
  }
  if (unit.role === "definition") {
    const subject = definitionSubject(unit.fact.content);
    if (subject) score = Math.max(score, semanticTopicTextAlignment(heading, subject));
  }
  return Math.min(1, score);
}

export function semanticEvidenceExplanationFit(input: {
  heading: string;
  unit: SemanticEvidenceUnit;
  kind: "topic" | "framework" | "procedure";
  localPedagogicalRelation?: boolean;
}): { passed: boolean; score: number } {
  const { heading, unit, kind } = input;
  if (!unit.explanationEligible && kind === "topic") return { passed: false, score: 0 };
  if (["metadata", "narrative", "transition", "exercise", "example", "warning", "limitation"].includes(unit.role)) {
    return { passed: false, score: 0 };
  }

  const alignment = semanticEvidenceTopicAlignment(heading, unit);
  const roleScore = explanationRoleScore(unit.role);
  const localFramework = kind !== "topic" && ["procedure", "framework_component", "principle", "objective", "supporting", "method"].includes(unit.role);
  const localSourceRelation = sourceHeadingRoleFit(heading, unit.sectionHeading, unit.role);
  const localPedagogical = Boolean(
    input.localPedagogicalRelation &&
    ["principle", "objective", "mechanism", "method", "supporting"].includes(unit.role),
  );
  // For ordinary learner topics, a single generic-token overlap is not enough
  // to let an important fact become the explanation. Synthetic role topics
  // receive a strong semantic anchor in semanticEvidenceTopicAlignment(),
  // while source/framework relations remain explicit escape hatches.
  const passed = alignment >= 0.34 || localFramework || localSourceRelation || localPedagogical;
  const score = Math.min(
    1,
    alignment * 0.68 + roleScore * 0.22 + Math.max(0, Math.min(1, unit.learningUtility)) * 0.10 +
      (localFramework ? 0.10 : 0) + (localSourceRelation ? 0.10 : 0) + (localPedagogical ? 0.08 : 0),
  );
  return { passed, score };
}

export function semanticEvidencePointFit(input: {
  heading: string;
  explanation: SemanticEvidenceUnit;
  unit: SemanticEvidenceUnit;
  kind: "topic" | "framework" | "procedure";
  sameFramework?: boolean;
}): { passed: boolean; score: number } {
  const { heading, explanation, unit, kind } = input;
  if (!unit.pointEligible) return { passed: false, score: 0 };
  if (["metadata", "narrative", "transition", "exercise", "example"].includes(unit.role)) {
    return { passed: false, score: 0 };
  }

  const topicAlignment = semanticEvidenceTopicAlignment(heading, unit);
  const explanationAlignment = semanticTextOverlap(
    explanation.fact.content,
    unit.fact.content,
  );
  const structuralRelation = Boolean(
    input.sameFramework ||
    (kind === "procedure" && unit.role === "procedure"),
  );
  const alignment = Math.max(topicAlignment, explanationAlignment);
  // Key points must belong to the learner topic, not merely share one broad
  // word with the explanation. This prevents facts from neighbouring source
  // sections leaking into otherwise coherent cards.
  const passed = topicAlignment >= 0.30 || explanationAlignment >= 0.34 || structuralRelation;
  const score = Math.min(
    1,
    alignment * 0.72 + Math.max(0, Math.min(1, unit.learningUtility)) * 0.18 +
      (structuralRelation ? 0.16 : 0),
  );
  return { passed, score };
}

export function isStructuralSemanticHeading(value: string): boolean {
  const heading = stripNumbering(normaliseHeading(value));
  return STRUCTURAL_HEADING_RE.test(heading) ||
    REFERENCE_HEADING_RE.test(heading) ||
    METADATA_HEADING_RE.test(heading) ||
    PRACTICE_HEADING_RE.test(heading) ||
    GENERIC_STRUCTURE_TOKEN_RE.test(heading);
}

export function semanticRoleTopicLabel(
  role: SemanticEvidenceRole,
): string | null {
  switch (role) {
    case "method":
      return "Method and Approach";
    case "finding":
      return "Results and Findings";
    case "cause_effect":
      return "Cause and Effect";
    case "objective":
      return "Purpose and Goals";
    default:
      return null;
  }
}

function collectConceptLabels(
  concepts: ImportantConcept[],
): Map<string, string[]> {
  const output = new Map<string, string[]>();
  for (const concept of concepts) {
    for (const sectionId of concept.sourceSectionIds) {
      const list = output.get(sectionId) ?? [];
      list.push(concept.name);
      output.set(sectionId, list);
    }
  }
  return output;
}

function collectTermLabels(
  terms: QualifiedTerm[],
): Map<string, string[]> {
  const output = new Map<string, string[]>();
  for (const term of terms) {
    const list = output.get(term.sourceSectionId) ?? [];
    list.push(term.term);
    output.set(term.sourceSectionId, list);
  }
  return output;
}

function labelsAnchoredToFact(labels: string[], factText: string): string[] {
  return labels.filter((label) => {
    const direct = semanticTopicTextAlignment(label, factText);
    // A label attached to the same source section is not automatically about
    // every fact in that section. Require a meaningful fact-level anchor.
    return direct >= 0.28 || semanticTextOverlap(label, factText) >= 0.32;
  });
}

function detectFrameworkGroups(
  sections: SectionCoverage[],
  unitsByFactId: Map<string, SemanticEvidenceUnit>,
  sectionRoleById: Map<string, SemanticSectionRole>,
): SemanticFrameworkGroup[] {
  const output: SemanticFrameworkGroup[] = [];

  sections.forEach((section, index) => {
    if (sectionRoleById.get(section.sectionId) !== "framework") return;
    const name = stripNumbering(normaliseHeading(section.heading));
    const componentSectionIds: string[] = [];

    for (let cursor = index + 1; cursor < sections.length && cursor <= index + 8; cursor += 1) {
      const candidate = sections[cursor];
      if (!candidate) break;
      const candidateRole = sectionRoleById.get(candidate.sectionId) ?? "content";
      if (["reference", "caution", "practice", "metadata", "framework"].includes(candidateRole)) break;
      if (candidateRole === "structural") break;

      const candidateUnits = candidate.factIds
        .map((id) => unitsByFactId.get(id))
        .filter((unit): unit is SemanticEvidenceUnit => Boolean(unit));
      if (!looksLikeFrameworkComponent(candidate.heading, candidateUnits)) break;
      componentSectionIds.push(candidate.sectionId);
    }

    if (componentSectionIds.length > 0) {
      output.push({
        id: `framework:${section.sectionId}`,
        name,
        parentSectionId: section.sectionId,
        componentSectionIds,
        sourceOrder: index,
      });
    }
  });

  return output;
}

function looksLikeFrameworkComponent(
  headingValue: string,
  units: SemanticEvidenceUnit[],
): boolean {
  const heading = stripNumbering(normaliseHeading(headingValue));
  const words = heading.split(/\s+/u).filter(Boolean);
  if (!heading || words.length > 5) return false;
  if (FRAMEWORK_COMPONENT_LABEL_RE.test(heading)) return true;
  if (isStructuralSemanticHeading(heading)) return false;

  const independentDefinition = units.some((unit) =>
    unit.role === "definition" &&
    semanticTopicTextAlignment(heading, unit.fact.content) >= 0.35,
  );
  if (independentDefinition) return false;

  const componentLikeFacts = units.filter((unit) =>
    ["objective", "principle", "procedure", "supporting"].includes(unit.role),
  );
  return componentLikeFacts.length > 0 && componentLikeFacts.length === units.length;
}

function buildRegionAssignments(
  sections: SectionCoverage[],
): Map<string, string> {
  const output = new Map<string, string>();
  let regionCounter = 0;
  let currentRegion = "region-0";
  let sectionsInCurrent = 0;

  sections.forEach((section, index) => {
    const heading = normaliseHeading(section.heading);
    const semanticHeading = stripNumbering(heading);
    const topLevel = heading.match(TOP_LEVEL_NUMBER_RE);
    const majorStructural = MAJOR_STRUCTURAL_REGION_RE.test(semanticHeading);

    if (index === 0) {
      currentRegion = topLevel
        ? `region-${topLevel[1] ?? topLevel[2] ?? 0}`
        : "region-0";
    } else if (topLevel || majorStructural || sectionsInCurrent >= 5) {
      regionCounter += 1;
      currentRegion = topLevel
        ? `region-${topLevel[1] ?? topLevel[2] ?? regionCounter}`
        : `region-${regionCounter}`;
      sectionsInCurrent = 0;
    }

    output.set(section.sectionId, currentRegion);
    sectionsInCurrent += 1;
  });

  return output;
}

function summariseRegions(
  sections: SectionCoverage[],
  units: SemanticEvidenceUnit[],
  regionBySectionId: Map<string, string>,
): SemanticRegion[] {
  const byId = new Map<string, SemanticRegion>();
  sections.forEach((section, sourceOrder) => {
    const id = regionBySectionId.get(section.sectionId) ?? "region-0";
    const existing = byId.get(id) ?? {
      id,
      sectionIds: [],
      sourceOrder,
      evidenceCount: 0,
    };
    existing.sectionIds.push(section.sectionId);
    existing.evidenceCount += units.filter((unit) =>
      unit.sectionId === section.sectionId &&
      unit.pointEligible,
    ).length;
    byId.set(id, existing);
  });
  return [...byId.values()].sort((left, right) => left.sourceOrder - right.sourceOrder);
}

function looksLikeMetadata(
  text: string,
  sectionRole: SemanticSectionRole,
): boolean {
  if (META_TEXT_RE.test(text)) return true;
  if (AFFILIATION_RE.test(text) && !PREDICATE_RE.test(text)) return true;
  // A title/front-matter section is structural metadata, but it can still
  // contain a real factual statement (for example, a result embedded in a
  // conference front page). Do not erase the fact merely because of the
  // container; only metadata-like, non-predicative text inherits the role.
  if (sectionRole === "metadata" && !PREDICATE_RE.test(text)) return true;
  if (/^(?:[\p{Lu}][\p{L}'’-]+\s+){1,4}(?:and\s+)?(?:[\p{Lu}][\p{L}'’-]+)(?:\s*\([^)]*(?:university|institute|ltd\.?|department)[^)]*\))?$/u.test(text)) {
    return true;
  }
  return false;
}

function sourceHeadingRoleFit(
  topicHeading: string,
  sourceHeading: string,
  role: SemanticEvidenceRole,
): boolean {
  const topic = stripNumbering(normaliseHeading(topicHeading));
  const source = stripNumbering(normaliseHeading(sourceHeading));
  if (!topic || canonicalStudyConceptKey(topic) !== canonicalStudyConceptKey(source)) return false;

  switch (role) {
    case "method":
      return /\b(?:build|building|method|approach|model|methodology|implementation)\b/iu.test(topic);
    case "mechanism":
    case "cause_effect":
      return /\b(?:how|mechanism|relationship|cause|effect|process|interaction|operation)\b/iu.test(topic);
    case "finding":
      return /\b(?:result|finding|validation|evaluation|outcome|performance)\b/iu.test(topic);
    case "objective":
      return /\b(?:goal|objective|purpose|aim|understand|identify|define|verify|validate)\b/iu.test(topic);
    case "principle":
      return /^(?:know|show|explain|use|invite|tell|be|keep|avoid|prefer|understand|confirm|connect|communicate|present|validate|verify|prioriti[sz]e)\b/iu.test(topic) ||
        /\b(?:principle|rule|guideline|best\s+practice)\b/iu.test(topic);
    default:
      return false;
  }
}

function explanationRoleScore(role: SemanticEvidenceRole): number {
  const scores: Record<SemanticEvidenceRole, number> = {
    definition: 1,
    cause_effect: 0.95,
    mechanism: 0.92,
    method: 0.92,
    principle: 0.90,
    objective: 0.86,
    finding: 0.82,
    formula: 0.78,
    supporting: 0.55,
    procedure: 0.40,
    framework_component: 0.35,
    warning: 0,
    limitation: 0,
    example: 0,
    exercise: 0,
    metadata: 0,
    narrative: 0,
    transition: 0,
  };
  return scores[role];
}

function definitionSubject(value: string): string | null {
  const match = cleanText(value).match(/^(.{3,80}?)\s+(?:is|are|means|refers\s+to)\s+/iu);
  return match?.[1] ? normaliseHeading(match[1]) : null;
}

function meaningfulTokens(value: string): Set<string> {
  const tokens = value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu) ?? [];
  return new Set(
    tokens
      .map((token) => token.replace(/(?:ing|ed|es|s)$/u, ""))
      .filter((token) => token.length >= 2 && !TOPIC_STOP_WORDS.has(token)),
  );
}

function stemsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length < 4 || right.length < 4) return false;
  return left.startsWith(right) || right.startsWith(left);
}

function normaliseHeading(value: string): string {
  return value
    .replace(/^#+\s*/u, "")
    .replace(/[\r\n]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripNumbering(value: string): string {
  return value.replace(NUMBERED_PREFIX_RE, "").trim();
}

function cleanText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

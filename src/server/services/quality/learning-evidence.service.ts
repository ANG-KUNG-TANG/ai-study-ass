import type {
  AtomicFact,
  GroundedKnowledge,
  ImportantConcept,
  QualifiedTerm,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import {
  canonicalStudyConceptKey,
  isStudyNoiseLine,
} from "@/server/intelligence/pipeline/source-hygiene";
import {
  canonicalizeStudyConceptLabel,
  isExampleOnlyConceptEvidence,
  isValidConcept,
} from "@/server/intelligence/reliability/concept-validator";

export type LearningEvidenceRole =
  | "core"
  | "supporting"
  | "definition"
  | "procedure"
  | "warning"
  | "example"
  | "reference"
  | "metadata"
  | "noise";

export interface LearningEvidenceProfile {
  facts: AtomicFact[];
  coreFacts: AtomicFact[];
  supportingFacts: AtomicFact[];
  procedureFacts: AtomicFact[];
  warningFacts: AtomicFact[];
  exampleFacts: AtomicFact[];
  concepts: ImportantConcept[];
  keyTerms: QualifiedTerm[];
  sections: SectionCoverage[];
  rolesByFactId: Map<string, LearningEvidenceRole>;
  suppressedFactIds: Set<string>;
}

const METADATA_FIELD_RE = /^(?:project\s+name|team\s+members?|course(?:\s+code)?|date|student(?:\s+(?:name|id))?|lecturer|instructor|teacher|last\s+success|last\s+updated|status|configured)\s*:/iu;
const SOURCE_SCAFFOLD_RE = /^(?:slide\s+\d+\b.*|page\s+\d+\b.*|student\s+presentation\s+template)$/iu;
const UI_FRAGMENT_RE = /^(?:desktop|services?|config|attributes|physical|programming|on|off|add|edit|save|go|next|back|tabs?)$/iu;
const UI_NAVIGATION_RE = /(?:^|\s)(?:click|select|open|choose|enable|disable|turn\s+on|turn\s+off|go\s+to)\b|(?:>>|→|\u2192)|\b(?:desktop|services?|config|tab|button|menu)\s*(?:>>|→|:)/iu;
const STEP_LABEL_RE = /^(?:step|stage|test|phase|part)\s*\d+(?:\s*[:\-].*)?$/iu;
const GENERIC_LABEL_RE = /^(?:there|name|address|value|item|details?|information|data|content|note|notes|example|question|answer|what|when|where|why|how)$/iu;
const CONCEPT_VERB_RE = /\b(?:is|are|was|were|be|being|been|has|have|had|does|do|did|uses?|translates?|converts?|connects?|sends?|receives?|shows?|explains?|provides?|contains?|includes?|requires?|allows?|ensures?|prevents?|represents?|displays?)\b/iu;
const CORRECTION_CUE_RE = /\b(?:instead|rather\s+than|should\s+not|must\s+not|cannot|can't|normally\s+(?:cannot|can't|is\s+not|isn't)|incorrect|invalid|valid\s+(?:host|address)|use\s+.+\s+instead|recommended|warning|important\s+(?:practical\s+)?note)\b/iu;
const LOW_INFORMATION_FACT_RE = /^(?:[-–—>→↓\s]*|(?:name|address|service|desktop|web|switch\d*|server\d*)\s*:?\s*)$/iu;

export function buildLearningEvidenceProfile(
  grounding: GroundedKnowledge,
): LearningEvidenceProfile {
  const sectionsById = new Map(
    grounding.sections.map((section) => [section.sectionId, section]),
  );
  const rolesByFactId = new Map<string, LearningEvidenceRole>();
  const supported = grounding.facts.filter(
    (fact) => fact.verificationStatus === "supported" && fact.evidence.length > 0,
  );

  for (const fact of supported) {
    rolesByFactId.set(
      fact.id,
      classifyLearningFact(fact, sectionsById.get(fact.sourceSectionId)),
    );
  }

  const warningFacts = supported.filter(
    (fact) => rolesByFactId.get(fact.id) === "warning",
  );
  const suppressedFactIds = findFactsQualifiedByCorrections(
    supported,
    warningFacts,
    rolesByFactId,
  );
  const facts = supported.filter((fact) => {
    const role = rolesByFactId.get(fact.id);
    return Boolean(
      role &&
      !["noise", "metadata", "reference"].includes(role) &&
      !suppressedFactIds.has(fact.id),
    );
  });
  const concepts = selectLearningConcepts(grounding.concepts);
  const keyTerms = selectLearningKeyTerms(grounding.keyTerms);
  const visibleFactIds = new Set(facts.map((fact) => fact.id));
  const sections = grounding.sections
    .filter((section) => section.status === "covered")
    .map((section) => ({
      ...section,
      factIds: section.factIds.filter((id) => visibleFactIds.has(id)),
    }))
    .filter((section) => section.factIds.length > 0 && !isReferenceHeading(section.heading));

  return {
    facts,
    coreFacts: facts.filter((fact) => {
      const role = rolesByFactId.get(fact.id);
      return role === "core" || role === "definition";
    }),
    supportingFacts: facts.filter(
      (fact) => rolesByFactId.get(fact.id) === "supporting",
    ),
    procedureFacts: facts.filter(
      (fact) => rolesByFactId.get(fact.id) === "procedure",
    ),
    warningFacts: facts.filter(
      (fact) => rolesByFactId.get(fact.id) === "warning",
    ),
    exampleFacts: facts.filter(
      (fact) => rolesByFactId.get(fact.id) === "example",
    ),
    concepts,
    keyTerms,
    sections,
    rolesByFactId,
    suppressedFactIds,
  };
}

export function classifyLearningFact(
  fact: AtomicFact,
  section?: SectionCoverage,
): LearningEvidenceRole {
  const content = cleanText(fact.content);
  const heading = cleanHeading(section?.heading ?? "");

  if (!content || LOW_INFORMATION_FACT_RE.test(content) || isStudyNoiseLine(content)) {
    return "noise";
  }
  if (METADATA_FIELD_RE.test(content)) return "metadata";
  if (isReferenceHeading(heading, content)) return "reference";
  if (fact.type === "example" || isExampleOnlyConceptEvidence(content)) return "example";
  if (
    ["warning", "common_mistake", "limitation"].includes(fact.type) ||
    isCautionHeading(heading) ||
    CORRECTION_CUE_RE.test(content)
  ) {
    return "warning";
  }
  if (fact.type === "procedure_step" || isProcedureHeading(heading)) return "procedure";
  if (fact.type === "definition") return "definition";
  if (
    ["rule", "condition", "result", "formula", "relationship", "objective"].includes(fact.type) ||
    fact.importanceScore >= 0.82
  ) {
    return "core";
  }
  return "supporting";
}

export function isLearningConceptEligible(
  concept: ImportantConcept,
): boolean {
  const label = canonicalizeStudyConceptLabel(concept.name).trim();
  if (!label || !isValidConcept(label) || isStudyNoiseLine(label)) return false;
  if (GENERIC_LABEL_RE.test(label) || STEP_LABEL_RE.test(label)) return false;
  if (/^["'“”‘’]/u.test(label) || /[?!.:]$/u.test(label)) return false;
  if (/^(?:step|stage|test|phase|part)\s*\d+\b/iu.test(label)) return false;
  if (/^the\s+.+\b(?:is|are|uses?|translates?|converts?|connects?|sends?|shows?)\b/iu.test(label)) return false;
  if (CONCEPT_VERB_RE.test(label) && label.split(/\s+/u).length >= 3) return false;

  const evidence = concept.evidence.map((item) => cleanText(item.text)).filter(Boolean);
  if (
    UI_FRAGMENT_RE.test(label) &&
    (evidence.length === 0 || evidence.every((item) => UI_NAVIGATION_RE.test(item) || item.length < 28))
  ) {
    return false;
  }
  if (
    isExampleOnlyConceptEvidence(concept.explanation ?? "") ||
    (evidence.length > 0 && evidence.every(isExampleOnlyConceptEvidence))
  ) {
    return false;
  }

  return true;
}

export function selectLearningConcepts(
  concepts: ImportantConcept[],
  limit = Number.POSITIVE_INFINITY,
): ImportantConcept[] {
  const ranked = [...concepts]
    .filter(isLearningConceptEligible)
    .sort((left, right) => conceptUtilityScore(right) - conceptUtilityScore(left));
  const output: ImportantConcept[] = [];
  const seen = new Set<string>();

  for (const concept of ranked) {
    const name = canonicalizeStudyConceptLabel(concept.name);
    const key = canonicalStudyConceptKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({
      ...concept,
      name,
      normalizedName: key,
    });
    if (output.length >= limit) break;
  }

  return output;
}

export function selectLearningKeyTerms(
  terms: QualifiedTerm[],
  limit = Number.POSITIVE_INFINITY,
): QualifiedTerm[] {
  const output: QualifiedTerm[] = [];
  const seen = new Set<string>();

  for (const term of [...terms].sort((a, b) => b.confidence - a.confidence)) {
    const display = canonicalizeStudyConceptLabel(term.term);
    const key = canonicalStudyConceptKey(display);
    const pseudoConcept: ImportantConcept = {
      name: display,
      normalizedName: key,
      explanation: term.definition,
      sourceSectionIds: [term.sourceSectionId],
      evidence: term.evidence,
      importanceScore: term.confidence,
    };
    if (!key || seen.has(key) || !isLearningConceptEligible(pseudoConcept)) continue;
    if (term.definition.trim().split(/\s+/u).length < 4) continue;
    seen.add(key);
    output.push({ ...term, term: display });
    if (output.length >= limit) break;
  }

  return output;
}

export function isReferenceHeading(
  value: string,
  supportingText = "",
): boolean {
  const heading = cleanHeading(value);
  return Boolean(
    !heading ||
    SOURCE_SCAFFOLD_RE.test(heading) ||
    /^slide\s+\d+\b/iu.test(heading) ||
    isStudyNoiseLine(heading) ||
    (UI_FRAGMENT_RE.test(heading) && UI_NAVIGATION_RE.test(supportingText)),
  );
}

export function isCautionHeading(value: string): boolean {
  return /^(?:common\s+mistakes?(?:\s+students?\s+make)?|warnings?|pitfalls?|limitations?|important\s+(?:practical\s+)?note)$/iu.test(
    cleanHeading(value),
  );
}

export function isCorrectionOrWarningText(value: string): boolean {
  const text = cleanText(value);
  return CORRECTION_CUE_RE.test(text) ||
    /\b(?:avoid|do\s+not|don'?t|never|warning|incorrect|invalid|pitfall|limitation)\b/iu.test(text);
}

export function isProcedureHeading(value: string): boolean {
  const heading = cleanHeading(value);
  return /^(?:step|stage|test|phase|part)\s*\d+\b/iu.test(heading) ||
    /\b(?:configuration|configure|setup|set\s+up|testing|verification|procedure|process|workflow|implementation)\b/iu.test(heading);
}

export function factLearningUtilityScore(
  fact: AtomicFact,
  role: LearningEvidenceRole,
): number {
  const roleBoost: Record<LearningEvidenceRole, number> = {
    definition: 0.18,
    core: 0.15,
    warning: 0.14,
    procedure: 0.10,
    supporting: 0.03,
    example: -0.10,
    reference: -0.40,
    metadata: -0.50,
    noise: -0.60,
  };
  const length = fact.content.trim().length;
  const completeness = /[.!?]$/u.test(fact.content.trim()) ? 0.04 : 0;
  const fragmentPenalty = /^(?:step|stage|test)\s*\d+\b|^[^:]{1,24}:\s*\S+$/iu.test(fact.content.trim())
    ? 0.14
    : 0;
  return fact.importanceScore + fact.confidence * 0.08 + roleBoost[role] + completeness - fragmentPenalty - (length < 24 ? 0.08 : 0);
}

function conceptUtilityScore(concept: ImportantConcept): number {
  const evidenceCount = Math.min(3, concept.evidence.length) / 3;
  const definitionBoost = concept.explanation && concept.explanation.trim().split(/\s+/u).length >= 4 ? 0.08 : 0;
  return concept.importanceScore + evidenceCount * 0.08 + definitionBoost;
}

function findFactsQualifiedByCorrections(
  facts: AtomicFact[],
  warningFacts: AtomicFact[],
  roles: Map<string, LearningEvidenceRole>,
): Set<string> {
  const suppressed = new Set<string>();

  for (const warning of warningFacts) {
    if (!CORRECTION_CUE_RE.test(warning.content)) continue;
    const warningTokens = meaningfulTokens(warning.content);
    const warningNumbers = numericTokens(warning.content);

    for (const candidate of facts) {
      if (candidate.id === warning.id || roles.get(candidate.id) === "warning") continue;
      if (candidate.sourceSectionId !== warning.sourceSectionId && !sharesEvidencePage(candidate, warning)) continue;

      const overlap = tokenCoverage(meaningfulTokens(candidate.content), warningTokens);
      const candidateNumbers = numericTokens(candidate.content);
      const numericConflict = candidateNumbers.size > 0 && warningNumbers.size > 0 && !setsEqual(candidateNumbers, warningNumbers);

      if ((numericConflict && overlap >= 0.25) || overlap >= 0.72) {
        suppressed.add(candidate.id);
      }
    }
  }

  return suppressed;
}

function sharesEvidencePage(left: AtomicFact, right: AtomicFact): boolean {
  const leftPages = new Set(left.evidence.map((item) => item.pageNumber).filter(Boolean));
  return right.evidence.some((item) => item.pageNumber && leftPages.has(item.pageNumber));
}

function meaningfulTokens(value: string): Set<string> {
  const stop = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "the", "this", "to", "was", "were", "with",
  ]);
  return new Set(
    (cleanText(value).toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._/-]*/gu) ?? [])
      .filter((token) => token.length >= 2 && !stop.has(token)),
  );
}

function numericTokens(value: string): Set<string> {
  return new Set(value.match(/\b\d+(?:\.\d+)*(?:%|\/\d+)?\b/gu) ?? []);
}

function tokenCoverage(left: Set<string>, right: Set<string>): number {
  if (left.size === 0) return 0;
  let matches = 0;
  for (const token of left) if (right.has(token)) matches += 1;
  return matches / left.size;
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#+\s*/u, "")
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function toLearningGrounding(
  grounding: GroundedKnowledge,
): GroundedKnowledge {
  const profile = buildLearningEvidenceProfile(grounding);
  const visibleFacts = profile.facts.filter(
    (fact) => profile.rolesByFactId.get(fact.id) !== "example",
  );
  const visibleFactIds = new Set(visibleFacts.map((fact) => fact.id));
  const sections = profile.sections
    .map((section) => ({
      ...section,
      factIds: section.factIds.filter((id) => visibleFactIds.has(id)),
    }))
    .filter((section) => section.factIds.length > 0);

  return {
    ...grounding,
    facts: visibleFacts,
    concepts: profile.concepts,
    keyTerms: profile.keyTerms,
    sections,
  };
}

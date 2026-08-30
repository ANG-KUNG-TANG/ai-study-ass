import type {
  AtomicFact,
  ImportantConcept,
  QualifiedTerm,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import {
  canonicalStudyConceptKey,
  isStudyNoiseLine,
} from "@/server/intelligence/pipeline/source-hygiene";
import {
  isExampleOnlyConceptEvidence,
} from "@/server/intelligence/reliability/concept-validator";
import {
  isCautionHeading,
  isProcedureHeading,
  isReferenceHeading,
  selectLearningConcepts,
  selectLearningKeyTerms,
} from "@/server/services/quality/learning-evidence.service";

const REFERENCE_HEADING_RE = /^(?:student\s+presentation\s+template|slide\s+\d+\b.*)$/iu;
const CAUTION_HEADING_RE = /^(?:common\s+mistakes?(?:\s+students?\s+make)?|warnings?|pitfalls?|limitations?)$/iu;
const STRUCTURAL_HEADING_RE = /^(?:a\s+brief\s+history|history|background|introduction|overview|objectives?|principles?|common\s+mistakes?(?:\s+students?\s+make)?|conclusion|summary|methodology|methods?|results?|discussion|limitations?|recommendations?|validation\s+points?|interaction\s+models?)$/iu;
const GENERIC_DETAIL_TAILS = new Set([
  "details",
  "detail",
  "information",
  "info",
  "data",
  "content",
  "notes",
  "note",
]);
const HEADING_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "of",
  "the",
  "to",
  "for",
  "in",
  "on",
  "with",
  "presentation",
]);
const SHORT_METADATA_LABEL_RE = /^(?:project\s+name|team\s+members?|course(?:\s+code)?|date|student(?:\s+(?:name|id))?|section|class|lecturer|instructor|teacher)$/iu;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/iu;
const DATE_VALUE_RE = /^(?:mon|tue|wed|thu|fri|sat|sun)?\s*\d{4}-\d{2}-\d{2}(?:\s*[:\-]\s*\d+(?:\.\d+)?)?$/iu;
const STATUS_VALUE_RE = /^(?:complete|completed|configured|enabled|disabled|healthy|ready|success|successful|failed|failure|pending|running|stopped|online|offline|available|unavailable|none|n\/?a|yes|no)$/iu;
const STATUS_LABEL_RE = /^(?:last\s+success|last\s+updated|tabs?|configured|document\s+processing|provider\s+quota|generation\s+status|worker\s+status|queue\s+status|system\s+status)$/iu;
const NAVIGATION_DEFINITION_RE = /^(?:is\s+)?(?:described|discussed|shown|presented|covered|introduced|explained)\s+(?:in|by)\s+(?:section|chapter|figure|table|page)\b/iu;

const WARNING_DIRECTIVE_RE = /^(?:avoid\b|do\s+not\b|don[’']?t\b|never\b|remember\s+to\b|ensure\b|use\b.+\binstead\b|forgetting\s+to\b|ignoring\b|overloading\b|using\s+too\s+much\b|presenting\b.+\bwithout\b)/iu;
const WARNING_CORRECTION_RE = /\b(?:should\s+not|must\s+not|cannot|can[’']?t|incorrect|invalid|pitfall|warning|recommended|instead\s+of|rather\s+than|reserved\s+(?:address|identifier)|not\s+valid)\b/iu;
const LIMITATION_RE = /\b(?:limitation|limited\s+to|does\s+not\s+support|unsupported|cannot\s+(?:handle|support|represent|process))\b/iu;
const WARNING_NARRATIVE_RE = /^(?:i|we|you[’']?ll|they|someone|my|our|this\s+book|the\s+questions?)\b/iu;

export function isSummaryReferenceHeading(value: string): boolean {
  const heading = cleanHeading(value);
  return REFERENCE_HEADING_RE.test(heading) || isReferenceHeading(heading);
}

export function isSummaryCautionHeading(value: string): boolean {
  return CAUTION_HEADING_RE.test(cleanHeading(value)) || isCautionHeading(value);
}


export function isActionableSummaryWarningFact(
  fact: AtomicFact,
  sectionHeading = "",
): boolean {
  const text = fact.content.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!text || text.endsWith("?") || /^q\s*[:;]/iu.test(text)) return false;
  if (WARNING_NARRATIVE_RE.test(text)) return false;

  if (fact.type === "limitation") {
    return LIMITATION_RE.test(text) || WARNING_CORRECTION_RE.test(text);
  }

  if (fact.type === "common_mistake") {
    return WARNING_DIRECTIVE_RE.test(text) ||
      /^(?:failing\s+to|forgetting\s+to|ignoring\b|overloading\b|using\b.+\bwithout\b|presenting\b.+\bwithout\b)/iu.test(text);
  }

  if (fact.type === "warning") {
    return WARNING_DIRECTIVE_RE.test(text) || WARNING_CORRECTION_RE.test(text);
  }

  if (isSummaryCautionHeading(sectionHeading)) {
    return WARNING_DIRECTIVE_RE.test(text) || WARNING_CORRECTION_RE.test(text) || LIMITATION_RE.test(text);
  }

  return false;
}

export function isActionableSummaryWarningText(value: string): boolean {
  const text = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!text || text.endsWith("?") || WARNING_NARRATIVE_RE.test(text)) return false;
  return WARNING_DIRECTIVE_RE.test(text) || WARNING_CORRECTION_RE.test(text) || LIMITATION_RE.test(text);
}

export function isSummaryCandidateTextEligible(value: string): boolean {
  const text = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!text || isStudyNoiseLine(text)) return false;
  if (SHORT_METADATA_LABEL_RE.test(text)) return false;
  if (ISO_TIMESTAMP_RE.test(text) || DATE_VALUE_RE.test(text)) return false;
  if (/^slide\s+\d+\b/iu.test(text)) return false;

  const field = text.match(/^([^:]{2,48}):\s*(.+)$/u);
  if (field) {
    const label = field[1].trim();
    const valuePart = field[2].trim();
    if (
      SHORT_METADATA_LABEL_RE.test(label) ||
      STATUS_LABEL_RE.test(label) ||
      STATUS_VALUE_RE.test(valuePart) ||
      ISO_TIMESTAMP_RE.test(valuePart) ||
      DATE_VALUE_RE.test(valuePart) ||
      /^summary\s*\|\s*quiz\s*\|\s*flashcards?/iu.test(valuePart)
    ) {
      return false;
    }
  }

  return true;
}

export function isSummaryHeadlineTextEligible(value: string): boolean {
  const text = value.trim();
  return (
    isSummaryCandidateTextEligible(text) &&
    text.length >= 18 &&
    !text.endsWith(":") &&
    !text.endsWith("?")
  );
}

export function isSummaryFactEligible(
  fact: AtomicFact,
  section?: SectionCoverage,
): boolean {
  if (fact.verificationStatus !== "supported") return false;
  if (fact.type === "example") return false;
  if (!isSummaryCandidateTextEligible(fact.content)) return false;
  if (section && isSummaryReferenceHeading(section.heading)) return false;
  return true;
}

export function selectSummarySections(
  sections: SectionCoverage[],
  factsById: Map<string, AtomicFact>,
): SectionCoverage[] {
  const output: SectionCoverage[] = [];
  const byKey = new Map<string, SectionCoverage>();
  const factKeysBySection = new Map<SectionCoverage, Set<string>>();

  for (const section of sections) {
    if (
      section.status !== "covered" ||
      isSummaryReferenceHeading(section.heading) ||
      isSummaryCautionHeading(section.heading) ||
      isProcedureHeading(section.heading)
    ) {
      continue;
    }

    const facts = section.factIds
      .map((id) => factsById.get(id))
      .filter((fact): fact is AtomicFact => Boolean(fact))
      .filter((fact) => isSummaryFactEligible(fact, section));

    if (
      facts.length === 0 ||
      isLikelyHeadingFactMismatch(section.heading, facts) ||
      isThinLearningSection(section.heading, facts)
    ) {
      continue;
    }

    const key = canonicalSectionKey(section.heading) || cleanHeading(section.heading).toLocaleLowerCase();
    let target = byKey.get(key);

    if (!target) {
      target = {
        ...section,
        heading: cleanHeading(section.heading),
        factIds: [],
        sourceUnitCount: 0,
        omittedUnitCount: 0,
      };
      byKey.set(key, target);
      output.push(target);
      factKeysBySection.set(target, new Set<string>());
    } else {
      target.pageStart = minDefined(target.pageStart, section.pageStart);
      target.pageEnd = maxDefined(target.pageEnd, section.pageEnd);
    }

    target.sourceUnitCount += section.sourceUnitCount;
    target.omittedUnitCount += section.omittedUnitCount;
    const seenFacts = factKeysBySection.get(target)!;

    for (const fact of facts) {
      const factKey = normaliseFact(fact.content);
      if (!factKey || seenFacts.has(factKey)) continue;
      seenFacts.add(factKey);
      target.factIds.push(fact.id);
    }
  }

  return output.filter((section) => section.factIds.length > 0);
}

export function selectSummaryConcepts(
  concepts: ImportantConcept[],
  limit: number,
): ImportantConcept[] {
  return selectLearningConcepts(concepts, limit);
}

export function selectSummaryKeyTerms(
  terms: QualifiedTerm[],
  limit: number,
): QualifiedTerm[] {
  const output: QualifiedTerm[] = [];
  const seen = new Set<string>();

  for (const term of selectLearningKeyTerms(terms)) {
    const rawTerm = term.term.trim();
    if (/^(?:my|our|your|their|both|since|continue|every|these|those|this|that|the\s+(?:questions?|emphasis|strategy|goal)|q\s*[:;])\b/iu.test(rawTerm)) {
      continue;
    }

    const displayTerm = rawTerm
      .replace(/^(?:a|an|the)\s+/iu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const words = displayTerm.split(/\s+/u).filter(Boolean);
    const key = canonicalStudyConceptKey(displayTerm);

    if (
      !key ||
      seen.has(key) ||
      words.length === 0 ||
      words.length > 5 ||
      /^(?:my|our|your|their|both|since|continue|every|these|those|this|that|q\s*[:;])\b/iu.test(displayTerm) ||
      /^(?:goal|questions?|emphasis|strategy|book|idea|thoughts?)$/iu.test(displayTerm) ||
      /^(?:data\s+from|toolset\s+provided\s+by|some\s+of|one\s+of|any\s+of)\b/iu.test(displayTerm) ||
      /^(?:one|two|three|several|many|few)\s+(?:probabilit|values?|things?|items?|forms?|types?|ways?|steps?)\b/iu.test(displayTerm) ||
      /\b(?:figure|table|section|page)\s*\d+\b/iu.test(displayTerm) ||
      /[?!]$/u.test(displayTerm) ||
      /\b(?:begins?|contains?|includes?|shows?|explains?|uses?|allows?|requires?)\b/iu.test(displayTerm) ||
      term.definition.trim().split(/\s+/u).length < 4 ||
      NAVIGATION_DEFINITION_RE.test(term.definition.trim())
    ) {
      continue;
    }

    seen.add(key);
    output.push({ ...term, term: displayTerm });
    if (output.length >= limit) break;
  }

  return output;
}

export function isMeaningfulSummaryNumberFact(fact: AtomicFact): boolean {
  if (fact.type === "formula" || fact.type === "result") return true;
  if (fact.type !== "number") return false;

  const text = fact.content.trim();
  if (!isSummaryCandidateTextEligible(text)) return false;
  if (ISO_TIMESTAMP_RE.test(text) || DATE_VALUE_RE.test(text)) return false;
  if (/\b(?:last\s+success|last\s+updated|requests?|waiting\s+to\s+start|telemetry|queue\s+depth|configured)\b/iu.test(text)) {
    return false;
  }

  return /\b(?:is|are|was|were|equals?|uses?|requires?|supports?|contains?|includes?|has|have|represents?|measures?|achieved|reported|improved|default|threshold|limit|sample|accuracy|precision|recall|rate|score|probability|cost|time|memory|complexity|priority|port)\b/iu.test(text);
}

export function isExampleOnlyConceptInText(
  concept: string,
  sourceText: string,
): boolean {
  const key = canonicalStudyConceptKey(concept);
  if (!key) return false;

  const contexts = sourceText
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const itemKey = canonicalStudyConceptKey(item);
      return item.toLocaleLowerCase().includes(concept.toLocaleLowerCase()) || itemKey.includes(key);
    });

  return contexts.length > 0 && contexts.every(isExampleOnlyConceptEvidence);
}

function isThinLearningSection(
  headingValue: string,
  facts: AtomicFact[],
): boolean {
  if (facts.length !== 1) return false;

  const heading = cleanHeading(headingValue);
  const fact = facts[0];
  const wordCount = heading.split(/\s+/u).filter(Boolean).length;
  const strongFact =
    ["definition", "rule", "result", "formula", "warning", "limitation"].includes(fact.type) ||
    fact.importanceScore >= 0.9;

  if (strongFact) return false;
  // Thin source-layout fragments are not learning topics. Keep this rule
  // domain-neutral: a short heading plus one short, non-core fact is usually
  // a label, UI fragment, table cell, or sub-step rather than a study section.
  return wordCount <= 3 && fact.content.trim().length < 48;
}

function isLikelyHeadingFactMismatch(
  headingValue: string,
  facts: AtomicFact[],
): boolean {
  const heading = cleanHeading(headingValue);
  if (!heading || STRUCTURAL_HEADING_RE.test(heading)) return false;
  if (/^(?:know|tell|use|be|invite|show|explain|present|review|validate|confirm)\b/iu.test(heading)) {
    return false;
  }

  const tokens = headingTokens(heading);
  if (tokens.length === 0) return false;

  const factTokens = new Set(
    facts.flatMap((fact) => [...textTokens(fact.content)]),
  );
  const overlap = tokens.some((token) => factTokens.has(token));
  if (overlap) return false;

  if (/^(?:ADMIN|ACCOUNT|SYSTEM|PDF|STATUS|SETTINGS)$/u.test(heading)) {
    return true;
  }

  if (tokens.length === 1 && /\p{L}s$/iu.test(heading)) {
    return true;
  }

  return tokens.length === 2 && GENERIC_DETAIL_TAILS.has(tokens[1]);
}

function canonicalSectionKey(value: string): string {
  const heading = cleanHeading(value);
  return canonicalStudyConceptKey(heading);
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#+\s*/u, "")
    .replace(/^\d+(?:\.\d+)*\s+/u, "")
    .replace(/\s+\(p{1,2}\.\s*\d+(?:-\d+)?\)$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function headingTokens(value: string): string[] {
  return [...textTokens(value)].filter((token) => !HEADING_STOP_WORDS.has(token));
}

function textTokens(value: string): Set<string> {
  return new Set(
    (value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [])
      .map((token) => token.replace(/s$/u, ""))
      .filter((token) => token.length >= 2),
  );
}

function normaliseFact(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}%+.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function minDefined(left?: number, right?: number): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function maxDefined(left?: number, right?: number): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}

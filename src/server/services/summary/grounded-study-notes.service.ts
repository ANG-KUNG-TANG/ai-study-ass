import type {
  AtomicFact,
  GroundedKnowledge,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import type { ReliableDocumentProfile } from "@/server/intelligence/reliability/types";
import { NOTE_RULES } from "@/server/entities/note.entity";

export const STUDY_NOTES_VERSION_MARKER = "<!-- intelligence-engine:v2.3 -->";

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

export function buildGroundedStudyNotes(
  grounding: GroundedKnowledge,
  profile: ReliableDocumentProfile | null,
  fallbackTitle: string,
): GroundedStudyNotesResult {
  const supportedFacts = grounding.facts.filter(
    (fact) => fact.verificationStatus === "supported",
  );
  const uniqueSupportedFacts = uniqueFacts(supportedFacts);
  const factsById = new Map(supportedFacts.map((fact) => [fact.id, fact]));
  const visibleSections = grounding.sections.filter(
    (section) => ["covered", "no_extractable_knowledge"].includes(section.status),
  );

  const overviewFacts = selectFacts(
    uniqueSupportedFacts.filter(isNarrativeFact),
    ["objective", "claim", "relationship", "definition"],
    3,
  );
  const keyPointFacts = selectDiverseFacts(
    uniqueSupportedFacts.filter(isKeyPointFact),
    ["rule", "condition", "result", "relationship", "claim", "number"],
    8,
  );
  const reservedTakeawayKeys = new Set(
    [...overviewFacts, ...keyPointFacts].map((fact) => normalise(fact.content)),
  );
  const takeawayFacts = selectTakeawayFacts(
    uniqueSupportedFacts.filter(
      (fact) =>
        !reservedTakeawayKeys.has(normalise(fact.content)) &&
        isTakeawayFact(fact),
    ),
    5,
  );
  const numberFacts = selectFacts(
    uniqueSupportedFacts.filter((fact) =>
      ["number", "result", "formula"].includes(fact.type),
    ),
    ["result", "formula", "number"],
    12,
  );
  const warningFacts = selectFacts(
    uniqueSupportedFacts.filter((fact) =>
      ["warning", "common_mistake", "limitation"].includes(fact.type),
    ),
    ["limitation", "warning", "common_mistake"],
    10,
  );
  const importantConcepts = grounding.concepts
    .slice(0, 16)
    .map((concept) => concept.name);
  const title = cleanHeading(profile?.title.value ?? fallbackTitle);

  const render = (options: BuildMarkdownOptions): string => {
    const sectionNotes = visibleSections
      .map((section) => renderSection(section, factsById, options))
      .filter(Boolean)
      .join("\n\n");

    return [
      `# ${title}`,
      STUDY_NOTES_VERSION_MARKER,
      "## Overview",
      renderOverview(overviewFacts, title),
      keyPointFacts.length > 0 ? "## Key Points" : "",
      renderFactList(keyPointFacts),
      importantConcepts.length > 0 ? "## Main Concepts" : "",
      importantConcepts.map((concept) => `- ${concept}`).join("\n"),
      grounding.keyTerms.length > 0 ? "## Key Terms" : "",
      grounding.keyTerms
        .map((term) =>
          `- **${term.term}:** ${term.definition}${pageLabel(term.evidence[0]?.pageNumber)}`,
        )
        .join("\n"),
      numberFacts.length > 0 ? "## Important Numbers, Formulas and Results" : "",
      renderFactList(numberFacts),
      warningFacts.length > 0 ? "## Limitations, Warnings and Common Mistakes" : "",
      renderFactList(warningFacts),
      sectionNotes ? "## Section Notes" : "",
      sectionNotes,
      takeawayFacts.length > 0 ? "## Key Takeaways" : "",
      renderTakeawayList(takeawayFacts),
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  };

  let summary = render({ factsPerSection: 24, compactSections: false });

  for (const factsPerSection of [16, 12, 8, 5, 3, 2, 1]) {
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

function renderSection(
  section: SectionCoverage,
  factsById: Map<string, AtomicFact>,
  options: BuildMarkdownOptions,
): string {
  const facts = section.factIds
    .map((id) => factsById.get(id))
    .filter((fact): fact is AtomicFact => Boolean(fact))
    .slice(0, options.factsPerSection);

  if (facts.length === 0) {
    return section.status === "no_extractable_knowledge"
      ? `### ${cleanHeading(section.heading)}${formatPageRange(section.pageStart, section.pageEnd)}`
      : "";
  }

  const pageRange = formatPageRange(section.pageStart, section.pageEnd);
  const heading = `### ${cleanHeading(section.heading)}${pageRange}`;

  if (!options.compactSections) {
    return `${heading}\n${renderSectionFactList(facts)}`;
  }

  const compactFact = shorten(facts[0].content, 190);
  return `${heading}\n- ${compactFact}`;
}

function renderOverview(facts: AtomicFact[], title: string): string {
  if (facts.length === 0) {
    return `These notes organise the verified knowledge extracted from ${title}.`;
  }

  return facts.map((fact) => stripTrailingListPunctuation(fact.content)).join(" ");
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

function renderSectionFactList(facts: AtomicFact[]): string {
  let hasOpenParent = false;

  return facts
    .map((fact) => {
      const content = fact.content.trim();

      if (content.endsWith(":")) {
        hasOpenParent = true;
        return `- ${content}`;
      }

      if (hasOpenParent && isListLikeChild(content)) {
        return `  - ${content}`;
      }

      hasOpenParent = false;
      return `- ${content}`;
    })
    .join("\n");
}

function isListLikeChild(value: string): boolean {
  return value.endsWith("?") ||
    (!/[.!]$/.test(value) && value.length <= 140);
}

function renderTakeawayList(facts: AtomicFact[]): string {
  return facts
    .map((fact) =>
      `- ${formatTakeaway(fact)}${pageLabel(fact.evidence[0]?.pageNumber)}`,
    )
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

function selectTakeawayFacts(
  facts: AtomicFact[],
  limit: number,
): AtomicFact[] {
  const ranked = selectDiverseFacts(
    facts,
    [
      "objective",
      "relationship",
      "procedure_step",
      "condition",
      "common_mistake",
      "warning",
      "limitation",
      "claim",
    ],
    facts.length,
  );
  const isCaution = (fact: AtomicFact): boolean =>
    ["warning", "common_mistake", "limitation"].includes(fact.type);
  const caution = ranked.find(isCaution);
  const selected = caution ? [caution] : [];

  for (const fact of ranked) {
    if (isCaution(fact)) continue;

    selected.push(fact);
    if (selected.length >= limit) break;
  }

  const order = new Map(ranked.map((fact, index) => [fact.id, index]));
  return selected.sort(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
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

function isNarrativeFact(fact: AtomicFact): boolean {
  const value = fact.content.trim();
  if (value.length < 28) return false;
  if (/^(?:project name|team members|course:|date|system purpose|problem summary|stakeholders|system scope)$/i.test(value)) {
    return false;
  }

  return /\b(?:is|are|was|were|must|should|needs?|allows?|ensures?|explains?|shows?|confirms?|demonstrates?|transforms?|reflects?|represents?|includes?|contains?|provides?|requires?|communicates?)\b/i.test(value) ||
    /[.!?]$/.test(value);
}

function isKeyPointFact(fact: AtomicFact): boolean {
  const value = fact.content.trim();
  if (value.length < 22 || value.endsWith(":") || value.endsWith("?")) return false;
  if (/^[“”"']/.test(value)) return false;
  if (/^(?:key\s+)?(?:functional requirements|non-functional requirements|business rules|constraints|assumptions|project name|team members|system purpose|purpose of the system)$/i.test(value)) {
    return false;
  }

  return isNarrativeFact(fact) ||
    ["result", "rule", "condition", "relationship"].includes(fact.type);
}

function isTakeawayFact(fact: AtomicFact): boolean {
  const value = fact.content.trim();

  if (value.endsWith(":") || value.endsWith("?")) return false;

  if (
    /^(?:purpose of the system|system purpose|use case list|use case diagram|domain model|project name|problem summary|stakeholders|system scope)$/i.test(
      value,
    )
  ) {
    return false;
  }

  if (fact.type === "common_mistake") {
    return value.length >= 18;
  }

  if (value.length < 32 || !isNarrativeFact(fact)) return false;

  return [
    "objective",
    "procedure_step",
    "warning",
    "common_mistake",
    "limitation",
    "condition",
    "relationship",
  ].includes(fact.type) ||
    /\b(?:must|should|ensure|avoid|confirm|validate|invite|demonstrate|communicate|align|prevent|explain|show)\b/i.test(
      value,
    );
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

function formatPageRange(start?: number, end?: number): string {
  if (!start) return "";
  if (!end || start === end) return ` (p. ${start})`;
  return ` (pp. ${start}-${end})`;
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

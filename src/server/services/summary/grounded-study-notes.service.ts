import type {
  AtomicFact,
  GroundedKnowledge,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import type { ReliableDocumentProfile } from "@/server/intelligence/reliability/types";
import { NOTE_RULES } from "@/server/entities/note.entity";

export const STUDY_NOTES_VERSION_MARKER = "<!-- intelligence-engine:v2.2 -->";

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
    4,
  );
  const keyPointFacts = selectFacts(
    uniqueSupportedFacts.filter(isKeyPointFact),
    ["rule", "condition", "result", "relationship", "claim", "number"],
    10,
  );
  const keyPointKeys = new Set(
    keyPointFacts.map((fact) => normalise(fact.content)),
  );
  const takeawayFacts = selectDiverseFacts(
    uniqueSupportedFacts.filter(
      (fact) =>
        !keyPointKeys.has(normalise(fact.content)) &&
        isTakeawayFact(fact),
    ),
    [
      "limitation",
      "warning",
      "common_mistake",
      "objective",
      "condition",
      "relationship",
      "procedure_step",
      "claim",
    ],
    6,
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
      renderFactList(takeawayFacts),
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
    return `${heading}\n${renderFactList(facts, false)}`;
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

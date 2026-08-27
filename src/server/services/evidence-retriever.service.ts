import type {
  AtomicFact,
  GroundedKnowledge,
  ImportantConcept,
} from "@/server/intelligence/grounding";

const DEFAULT_MAX_CHARACTERS = 7_000;
const DEFAULT_MAX_FACTS = 16;

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "does", "for", "from",
  "have", "how", "into", "its", "that", "the", "their", "this", "what",
  "when", "where", "which", "with", "would", "your",
]);

export interface GroundedEvidenceRequest {
  factIds?: readonly string[];
  sectionIds?: readonly string[];
  conceptNames?: readonly string[];
  queryTerms?: readonly string[];
  maxCharacters?: number;
  maxFacts?: number;
}

export interface GroundedEvidenceResult {
  text: string;
  factIds: string[];
  sectionIds: string[];
  conceptNames: string[];
  characterCount: number;
  wasTruncated: boolean;
}

/**
 * Select a small, deterministic evidence window from persisted GroundedKnowledge.
 *
 * This module owns retrieval mechanics only. Feature services decide which gaps
 * matter and pass those gap identifiers into the request.
 */
export function retrieveGroundedEvidence(
  grounding: GroundedKnowledge,
  request: GroundedEvidenceRequest,
): GroundedEvidenceResult {
  const maxCharacters = Math.max(
    1_200,
    Math.min(request.maxCharacters ?? DEFAULT_MAX_CHARACTERS, 12_000),
  );
  const maxFacts = Math.max(
    1,
    Math.min(request.maxFacts ?? DEFAULT_MAX_FACTS, 30),
  );

  const requestedFactIds = new Set(request.factIds ?? []);
  const requestedSectionIds = new Set(request.sectionIds ?? []);
  const requestedConceptNames = new Set(
    (request.conceptNames ?? []).map(normalise),
  );
  const queryTokens = new Set(tokenise((request.queryTerms ?? []).join(" ")));
  const sectionHeadings = new Map(
    grounding.sections.map((section) => [section.sectionId, section.heading]),
  );

  const requestedConcepts = grounding.concepts.filter((concept) =>
    requestedConceptNames.has(normalise(concept.name)),
  );
  const conceptSectionIds = new Set(
    requestedConcepts.flatMap((concept) => concept.sourceSectionIds),
  );

  const rankedFacts = grounding.facts
    .filter((fact) => fact.verificationStatus === "supported")
    .map((fact) => ({
      fact,
      score: scoreFact({
        fact,
        requestedFactIds,
        requestedSectionIds,
        conceptSectionIds,
        queryTokens,
        heading: sectionHeadings.get(fact.sourceSectionId) ?? "",
      }),
    }))
    .sort((left, right) =>
      right.score - left.score ||
      right.fact.importanceScore - left.fact.importanceScore,
    );

  const selectedFacts: AtomicFact[] = [];
  const selectedIds = new Set<string>();

  const addFact = (fact: AtomicFact | undefined): void => {
    if (!fact || selectedIds.has(fact.id) || selectedFacts.length >= maxFacts) {
      return;
    }
    selectedIds.add(fact.id);
    selectedFacts.push(fact);
  };

  // Guarantee direct fact requests first.
  for (const id of requestedFactIds) {
    addFact(rankedFacts.find((item) => item.fact.id === id)?.fact);
  }

  // Preserve section coverage when a feature specifically requests sections.
  for (const sectionId of new Set([
    ...requestedSectionIds,
    ...conceptSectionIds,
  ])) {
    addFact(
      rankedFacts.find((item) => item.fact.sourceSectionId === sectionId)?.fact,
    );
  }

  for (const item of rankedFacts) {
    addFact(item.fact);
    if (selectedFacts.length >= maxFacts) break;
  }

  const blocks: string[] = [];
  const conceptNames: string[] = [];

  for (const concept of requestedConcepts) {
    const block = renderConcept(concept);
    if (!block) continue;
    blocks.push(block);
    conceptNames.push(concept.name);
  }

  for (const fact of selectedFacts) {
    blocks.push(renderFact(fact, sectionHeadings.get(fact.sourceSectionId)));
  }

  const joined = blocks.filter(Boolean).join("\n\n").trim();
  const text = truncateAtBoundary(joined, maxCharacters);
  const selectedSectionIds = [...new Set(selectedFacts.map((fact) => fact.sourceSectionId))];

  return {
    text,
    factIds: selectedFacts.map((fact) => fact.id),
    sectionIds: selectedSectionIds,
    conceptNames,
    characterCount: text.length,
    wasTruncated: joined.length > text.length,
  };
}

function scoreFact(input: {
  fact: AtomicFact;
  requestedFactIds: Set<string>;
  requestedSectionIds: Set<string>;
  conceptSectionIds: Set<string>;
  queryTokens: Set<string>;
  heading: string;
}): number {
  const {
    fact,
    requestedFactIds,
    requestedSectionIds,
    conceptSectionIds,
    queryTokens,
    heading,
  } = input;

  let score = fact.importanceScore * 4;
  if (requestedFactIds.has(fact.id)) score += 100;
  if (requestedSectionIds.has(fact.sourceSectionId)) score += 45;
  if (conceptSectionIds.has(fact.sourceSectionId)) score += 25;

  if (queryTokens.size > 0) {
    const factTokens = new Set(tokenise(`${heading} ${fact.content}`));
    const overlap = [...queryTokens].filter((token) => factTokens.has(token)).length;
    score += overlap * 8;
  }

  return score;
}

function renderFact(fact: AtomicFact, heading?: string): string {
  const evidence = fact.evidence[0]?.text?.trim() || fact.content.trim();
  const page = fact.evidence[0]?.pageNumber;
  const label = cleanHeading(heading ?? "Verified evidence");
  const pageLabel = page ? ` | page ${page}` : "";
  return `[${label}${pageLabel}]\n${evidence}`;
}

function renderConcept(concept: ImportantConcept): string {
  const evidence = concept.evidence[0]?.text?.trim();
  if (!evidence) return "";
  return `[Concept: ${concept.name}]\n${evidence}`;
}

function tokenise(value: string): string[] {
  return (value.toLocaleLowerCase().match(/[\p{L}\p{N}-]{2,}/gu) ?? [])
    .filter((token) => !STOP_WORDS.has(token));
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanHeading(value: string): string {
  return value.replace(/\s+/gu, " ").trim() || "Verified evidence";
}

function truncateAtBoundary(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) return value;
  const candidate = value.slice(0, maxCharacters);
  const boundary = Math.max(candidate.lastIndexOf("\n\n"), candidate.lastIndexOf(". "));
  return candidate
    .slice(0, boundary >= maxCharacters * 0.65 ? boundary : candidate.length)
    .trim();
}

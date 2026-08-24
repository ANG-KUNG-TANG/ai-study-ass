import { createHash } from "node:crypto";
import type {
  EvidenceSpan,
  ExtractedClaim,
  KnowledgeCore,
  NLPResult,
} from "../types";
import type {
  DocumentSection,
  SectionedDocument,
} from "../pipeline/types";
import { splitTextUnits, type TextUnit } from "../pipeline/text-units";
import {
  getReliableProfile,
} from "../reliability/profile";
import {
  isValidConcept,
} from "../reliability/concept-validator";
import type {
  AtomicFact,
  AtomicFactType,
  GroundedKnowledge,
  GroundingQualityReport,
  ImportantConcept,
  QualifiedTerm,
  SectionCoverage,
} from "./types";
import { GROUNDING_SCHEMA_VERSION } from "./types";

const PIPELINE_VERSION = "intelligence-v2.0";
const MAX_FACTS_PER_SECTION = 24;

const PLACEHOLDER_RE = /^(?:\(?\s*insert\s+(?:a\s+)?(?:diagram|image|figure|chart)\s*\)?|placeholder|n\/?a)$/i;
const UI_ARTIFACT_RE = /^(?:svg\s*regenerate|regenerate\s+svg|generated\s+study\s+notes)$/i;
const SUBORDINATE_TERM_RE = /^(?:once|when|while|because|after|before|although|if|students?|the\s+goal|the\s+presentation)\b/i;
const TERM_VERB_RE = /\b(?:must|should|completed|finished|understand|presenting|communicate|showing|insert)\b/i;

export interface BuildGroundedKnowledgeInput {
  document: SectionedDocument;
  nlp: NLPResult;
  core: KnowledgeCore;
}

export function buildGroundedKnowledge(
  input: BuildGroundedKnowledgeInput,
): GroundedKnowledge {
  const facts: AtomicFact[] = [];
  const sections: SectionCoverage[] = [];

  for (const section of input.document.sections) {
    const classification = classifySection(section);

    if (classification.excluded) {
      sections.push({
        sectionId: section.id,
        heading: section.rawHeading,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        status: "excluded",
        factIds: [],
        sourceUnitCount: 0,
        omittedUnitCount: 0,
        reason: classification.reason,
      });
      continue;
    }

    const units = splitTextUnits(section.analysisBody)
      .filter((unit) => isMeaningfulUnit(unit.text));
    const sectionFacts = extractSectionFacts(section, units, input.document);
    facts.push(...sectionFacts);

    const status: SectionCoverage["status"] = sectionFacts.length > 0
      ? "covered"
      : units.length === 0
        ? "no_extractable_knowledge"
        : "failed";

    sections.push({
      sectionId: section.id,
      heading: section.rawHeading,
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      status,
      factIds: sectionFacts.map((fact) => fact.id),
      sourceUnitCount: units.length,
      omittedUnitCount: Math.max(0, units.length - sectionFacts.length),
      ...(status === "failed"
        ? { reason: "Meaningful source text was present, but no grounded facts were produced." }
        : {}),
    });
  }

  const claims = input.core.claims.filter(
    (claim) => claim.validationStatus === "valid",
  );
  const keyTerms = qualifyTerms(input.document, input.core, claims);
  const concepts = buildImportantConcepts(input.document, input.core, keyTerms);
  const quality = evaluateGroundingQuality(facts, keyTerms, sections);

  return {
    schemaVersion: GROUNDING_SCHEMA_VERSION,
    pipelineVersion: PIPELINE_VERSION,
    sourceHash: createHash("sha256")
      .update(input.document.sourceText)
      .digest("hex"),
    documentKind: input.core.documentProfile.kind,
    sourceLanguage: detectSourceLanguage(input.document.analysisText),
    facts,
    keyTerms,
    concepts,
    sections,
    quality,
    createdAt: new Date(),
  };
}

function classifySection(section: DocumentSection): {
  excluded: boolean;
  reason?: string;
} {
  if (section.semanticRole === "references") {
    return { excluded: true, reason: "Reference material is retained in the source but excluded from study-note synthesis." };
  }

  if (section.semanticRole === "title" || section.id === "section-preamble") {
    return { excluded: true, reason: "Document metadata is used for identification, not as study content." };
  }

  if (
    section.startOffset === 0 &&
    /^(?:lecture\s+note|student\s+presentation\s+template|chapter\s+\d+)\b/i.test(
      section.rawHeading,
    )
  ) {
    return { excluded: true, reason: "The opening document title is metadata rather than study content." };
  }

  const units = splitTextUnits(section.analysisBody)
    .map((unit) => unit.text)
    .filter(Boolean);

  if (units.length > 0 && units.every(isPlaceholderOrArtifact)) {
    return { excluded: true, reason: "The section contains only placeholders or processing artifacts." };
  }

  return { excluded: false };
}

function extractSectionFacts(
  section: DocumentSection,
  units: TextUnit[],
  document: SectionedDocument,
): AtomicFact[] {
  const candidates = units.map((unit, index) => {
    const type = classifyFact(unit.text, unit.kind);
    const content = normaliseText(unit.text);
    const evidence = createEvidence(section, content, index, document);
    const numericTokens = extractNumericTokens(content);
    const supported = evidence.text.length > 0 && evidenceIsPresent(evidence, section);
    const numericSupported = numericTokens.every((token) =>
      evidence.text.includes(token),
    );
    const verificationStatus = supported && numericSupported
      ? "supported" as const
      : supported
        ? "partially_supported" as const
        : "unsupported" as const;

    return {
      id: `fact-${safeId(section.id)}-${index + 1}`,
      type,
      content,
      verbatimRequired: ["definition", "number", "result", "formula"].includes(type),
      sourceSectionId: section.id,
      evidence: [evidence],
      evidenceType: "stated" as const,
      verificationStatus,
      confidence: verificationStatus === "supported" ? 0.96 : verificationStatus === "partially_supported" ? 0.62 : 0.2,
      importanceScore: importanceScore(type, unit, section),
      numericTokens,
      sourceOrder: index,
    };
  });

  if (candidates.length <= MAX_FACTS_PER_SECTION) {
    return candidates.map(({ sourceOrder: _sourceOrder, ...fact }) => fact);
  }

  const selected = [...candidates]
    .sort((left, right) =>
      right.importanceScore - left.importanceScore ||
      left.sourceOrder - right.sourceOrder,
    )
    .slice(0, MAX_FACTS_PER_SECTION)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);

  return selected.map(({ sourceOrder: _sourceOrder, ...fact }) => fact);
}

function classifyFact(text: string, kind: TextUnit["kind"]): AtomicFactType {
  const value = text.trim();
  const lower = value.toLowerCase();

  if (/\b(common mistakes?|mistakes? students? make|forgetting|ignoring|overloading)\b/.test(lower)) {
    return "common_mistake";
  }
  if (/\b(warning|avoid|do not|don't|never|incorrect|be careful|caution)\b/.test(lower)) {
    return "warning";
  }
  if (/\b(limitation|limited by|cannot|could not|restricted|caveat)\b/.test(lower)) {
    return "limitation";
  }
  if (looksLikeDefinition(value)) return "definition";
  if (looksLikeFormula(value)) return "formula";
  if (/\b(result|found|achieved|reported|improved|outperform|accuracy|precision|recall|f1|auc|rmse)\b/.test(lower) && extractNumericTokens(value).length > 0) {
    return "result";
  }
  if (extractNumericTokens(value).length > 0 && /\b(percent|percentage|rate|score|sample|participants?|projects?|years?|days?)\b|%/.test(lower)) {
    return "number";
  }
  if (/\b(objective|goal|purpose|aims? to|must understand)\b/.test(lower)) {
    return "objective";
  }
  if (/\b(if|when|unless|only when|before|after|must|should|needs? to|required to|ensure)\b/.test(lower)) {
    return "condition";
  }
  if (/\b(consists? of|contains?|includes?|depends? on|related to|associated with|maps? to|connects?)\b/.test(lower)) {
    return "relationship";
  }
  if (/\b(for example|for instance|such as|example)\b/.test(lower)) {
    return "example";
  }
  if (kind === "numbered" || (kind === "bullet" && startsWithActionVerb(value))) {
    return "procedure_step";
  }
  if (/\b(rule|policy|shall|required|prohibited)\b/.test(lower)) return "rule";
  return "claim";
}

function createEvidence(
  section: DocumentSection,
  text: string,
  index: number,
  document: SectionedDocument,
): EvidenceSpan {
  const locatedOffset = document.displayText.indexOf(text, section.startOffset);
  const startOffset = locatedOffset >= section.startOffset && locatedOffset <= section.endOffset
    ? locatedOffset
    : undefined;

  return {
    id: `evidence-v2-${safeId(section.id)}-${index + 1}`,
    sectionId: section.id,
    sectionTitle: section.rawHeading,
    pageNumber: section.pageStart,
    text,
    startOffset,
    endOffset: startOffset === undefined ? undefined : startOffset + text.length,
    chunkId: findChunkId(section.id, index),
  };
}

function findChunkId(
  sectionId: string,
  unitIndex: number,
): string {
  return `${sectionId}-unit-${unitIndex + 1}`;
}

function evidenceIsPresent(
  evidence: EvidenceSpan,
  section: DocumentSection,
): boolean {
  const needle = normaliseForMatching(evidence.text);
  return needle.length > 0 && (
    normaliseForMatching(section.body).includes(needle) ||
    normaliseForMatching(section.analysisBody).includes(needle)
  );
}

function qualifyTerms(
  document: SectionedDocument,
  core: KnowledgeCore,
  claims: ExtractedClaim[],
): QualifiedTerm[] {
  const profile = getReliableProfile(core);
  const candidates: Array<{
    term: string;
    definition: string;
    evidenceText: string;
    confidence: number;
    qualification: QualifiedTerm["qualification"];
  }> = [];

  for (const claim of claims.filter((item) => item.type === "definition")) {
    candidates.push({
      term: claim.subject,
      definition: claim.object,
      evidenceText: claim.evidence[0]?.text ?? `${claim.subject} ${claim.predicate} ${claim.object}`,
      confidence: claim.confidence,
      qualification: "explicit_definition",
    });
  }

  for (const term of profile?.keyTerms ?? []) {
    const occurrences = phraseFrequency(document.analysisText, term.term);
    const strongDefinition = term.confidence >= 0.82;
    const acronym = /^[A-Z][A-Z0-9-]{1,10}$/.test(term.term);

    candidates.push({
      term: term.term,
      definition: term.definition,
      evidenceText: term.evidence,
      confidence: term.confidence,
      qualification: strongDefinition || term.evidence.length >= 25
        ? "explicit_definition"
        : occurrences >= 2 || acronym
          ? "distinguished_and_repeated"
          : "glossary_definition",
    });
  }

  const output: QualifiedTerm[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates.sort((a, b) => b.confidence - a.confidence)) {
    const term = cleanTerm(candidate.term);
    const normalized = normaliseForMatching(term);
    if (!isQualifiedTermLabel(term) || seen.has(normalized)) continue;

    const located = locateEvidence(document, candidate.evidenceText, term);
    if (!located) continue;

    seen.add(normalized);
    output.push({
      term,
      definition: normaliseText(candidate.definition),
      sourceSectionId: located.section.id,
      evidence: [located.evidence],
      qualification: candidate.qualification,
      confidence: Math.min(0.99, Math.max(0.65, candidate.confidence)),
    });

    if (output.length >= 12) break;
  }

  return output;
}

function buildImportantConcepts(
  document: SectionedDocument,
  core: KnowledgeCore,
  terms: QualifiedTerm[],
): ImportantConcept[] {
  const profile = getReliableProfile(core);
  const candidates: Array<{
    term: string;
    confidence: number;
    evidence?: string;
  }> = [
    ...(profile?.concepts.map((concept) => ({
      term: concept.term,
      confidence: concept.confidence,
      evidence: concept.evidence,
    })) ?? []),
    ...core.concepts
      .filter((concept) => concept.valid)
      .map((concept) => ({
        term: concept.term,
        confidence: Math.min(0.95, Math.max(0.55, concept.score)),
        evidence: concept.evidence[0]?.text,
      })),
  ];

  const termDefinitions = new Map(
    terms.map((term) => [normaliseForMatching(term.term), term.definition]),
  );
  const output: ImportantConcept[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates.sort((a, b) => b.confidence - a.confidence)) {
    const name = cleanTerm(candidate.term);
    const normalizedName = normaliseForMatching(name);
    if (
      candidate.confidence < 0.62 ||
      !isValidConcept(name) ||
      !isQualifiedConceptLabel(name) ||
      seen.has(normalizedName)
    ) {
      continue;
    }

    const located = locateEvidence(document, candidate.evidence ?? "", name);
    if (!located) continue;

    seen.add(normalizedName);
    output.push({
      name,
      normalizedName,
      explanation: termDefinitions.get(normalizedName) ?? null,
      sourceSectionIds: [located.section.id],
      evidence: [located.evidence],
      importanceScore: Math.min(
        1,
        candidate.confidence * 0.72 +
          Math.min(phraseFrequency(document.analysisText, name) / 4, 1) * 0.28,
      ),
    });

    if (output.length >= 16) break;
  }

  for (const term of terms) {
    const normalizedName = normaliseForMatching(term.term);
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    output.push({
      name: term.term,
      normalizedName,
      explanation: term.definition,
      sourceSectionIds: [term.sourceSectionId],
      evidence: term.evidence,
      importanceScore: term.confidence,
    });
  }

  return output
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 16);
}

function locateEvidence(
  document: SectionedDocument,
  evidenceText: string,
  fallbackTerm: string,
): { section: DocumentSection; evidence: EvidenceSpan } | null {
  const evidenceNeedle = normaliseForMatching(evidenceText);
  const termNeedle = normaliseForMatching(fallbackTerm);
  const section = document.sections.find((candidate) => {
    const body = normaliseForMatching(candidate.analysisBody);
    return (evidenceNeedle.length >= 8 && body.includes(evidenceNeedle)) ||
      (termNeedle.length >= 3 && body.includes(termNeedle));
  });

  if (!section) return null;

  const text = evidenceNeedle.length >= 8 && normaliseForMatching(section.analysisBody).includes(evidenceNeedle)
    ? normaliseText(evidenceText)
    : sentenceContaining(section.analysisBody, fallbackTerm) ?? fallbackTerm;
  const localIndex = section.body.indexOf(text);
  const startOffset = localIndex >= 0 ? section.startOffset + localIndex : undefined;

  return {
    section,
    evidence: {
      id: `evidence-term-${safeId(section.id)}-${safeId(fallbackTerm)}`,
      sectionId: section.id,
      sectionTitle: section.rawHeading,
      pageNumber: section.pageStart,
      text,
      startOffset,
      endOffset: startOffset === undefined ? undefined : startOffset + text.length,
    },
  };
}

function evaluateGroundingQuality(
  facts: AtomicFact[],
  terms: QualifiedTerm[],
  sections: SectionCoverage[],
): GroundingQualityReport {
  const supportedFacts = facts.filter(
    (fact) => fact.verificationStatus === "supported",
  );
  const supportedFactRatio = facts.length === 0
    ? 0
    : supportedFacts.length / facts.length;
  const relevantSections = sections.filter(
    (section) => section.status !== "excluded",
  );
  const coveredSections = relevantSections.filter(
    (section) => ["covered", "no_extractable_knowledge"].includes(section.status),
  );
  const sectionCoverageRatio = relevantSections.length === 0
    ? 0
    : coveredSections.length / relevantSections.length;
  const numericFacts = facts.filter((fact) => fact.numericTokens.length > 0);
  const numericExactnessRatio = numericFacts.length === 0
    ? 1
    : numericFacts.filter((fact) =>
        fact.numericTokens.every((token) =>
          fact.evidence.some((evidence) => evidence.text.includes(token)),
        ),
      ).length / numericFacts.length;
  const qualifiedTermPrecision = terms.length === 0
    ? 1
    : terms.filter((term) =>
        isQualifiedTermLabel(term.term) && term.evidence.length > 0,
      ).length / terms.length;
  const normalizedFacts = facts.map((fact) => normaliseForMatching(fact.content));
  const duplicateCount = normalizedFacts.length - new Set(normalizedFacts).size;
  const duplicateFactRatio = facts.length === 0 ? 0 : duplicateCount / facts.length;
  const artifactCount = facts.filter((fact) => isPlaceholderOrArtifact(fact.content)).length +
    terms.filter((term) => isPlaceholderOrArtifact(term.term)).length;

  const score = clamp(
    supportedFactRatio * 0.29 +
      sectionCoverageRatio * 0.26 +
      numericExactnessRatio * 0.17 +
      qualifiedTermPrecision * 0.12 +
      (1 - duplicateFactRatio) * 0.1 +
      (artifactCount === 0 ? 1 : 0) * 0.06,
  );
  const warnings: string[] = [];

  if (facts.length === 0) warnings.push("No grounded facts were extracted from the relevant sections.");
  if (supportedFactRatio < 0.95) warnings.push("Some extracted facts were not fully supported by their evidence spans.");
  if (sectionCoverageRatio < 0.85) warnings.push("Relevant section coverage is below 85%.");
  if (numericExactnessRatio < 1) warnings.push("At least one numerical value does not exactly match its evidence.");
  if (duplicateFactRatio > 0.15) warnings.push("Duplicate fact content exceeds the 15% quality threshold.");
  if (artifactCount > 0) warnings.push(`${artifactCount} placeholder or processing artifact items were detected.`);

  const passed = facts.length > 0 &&
    supportedFactRatio >= 0.95 &&
    sectionCoverageRatio >= 0.85 &&
    numericExactnessRatio === 1 &&
    qualifiedTermPrecision >= 0.9 &&
    duplicateFactRatio <= 0.15 &&
    artifactCount === 0;

  return {
    score,
    scoreOutOf10: Number((score * 10).toFixed(2)),
    passed,
    supportedFactRatio,
    sectionCoverageRatio,
    numericExactnessRatio,
    qualifiedTermPrecision,
    duplicateFactRatio,
    artifactCount,
    warnings,
  };
}

function importanceScore(
  type: AtomicFactType,
  unit: TextUnit,
  section: DocumentSection,
): number {
  const typeScore: Record<AtomicFactType, number> = {
    definition: 0.96,
    result: 0.95,
    formula: 0.95,
    limitation: 0.92,
    warning: 0.9,
    common_mistake: 0.9,
    objective: 0.88,
    rule: 0.86,
    condition: 0.84,
    relationship: 0.8,
    procedure_step: 0.78,
    number: 0.78,
    example: 0.7,
    claim: 0.68,
  };
  const structuralBoost = unit.kind === "bullet" || unit.kind === "numbered" ? 0.05 : 0;
  const roleBoost = ["results", "conclusion", "method"].includes(section.semanticRole) ? 0.04 : 0;
  return Math.min(1, typeScore[type] + structuralBoost + roleBoost);
}

function looksLikeDefinition(value: string): boolean {
  const match = value.match(/^(.{2,80}?)\s*(?::|\bis\b|\bare\b|\bmeans\b|\brefers to\b)\s+(.{12,})$/i);
  return Boolean(match && isQualifiedTermLabel(match[1]));
}

function looksLikeFormula(value: string): boolean {
  return /\b(?:formula|equation)\b/i.test(value) ||
    /\b[A-Za-z][A-Za-z0-9_]*\s*=/.test(value) ||
    /(?:\d+(?:\.\d+)?|\b[A-Z]\b)\s*[+×÷*/-]\s*(?:\d+(?:\.\d+)?|\b[A-Z]\b)/u.test(value);
}

function startsWithActionVerb(value: string): boolean {
  return /^(?:ask|avoid|build|calculate|check|classify|compare|confirm|connect|create|define|demonstrate|describe|determine|develop|discuss|ensure|evaluate|explain|highlight|identify|include|invite|list|move|prepare|present|remove|review|select|show|summarise|summarize|use|validate|verify|write)\b/i.test(value);
}

function isMeaningfulUnit(value: string): boolean {
  const text = normaliseText(value);
  return text.length >= 5 &&
    /\p{L}/u.test(text) &&
    !isPlaceholderOrArtifact(text) &&
    !/^slide\s+\d+$/i.test(text) &&
    !/^(?:page|figure|table)\s+\d+$/i.test(text);
}

function isPlaceholderOrArtifact(value: string): boolean {
  const text = normaliseText(value);
  return PLACEHOLDER_RE.test(text) ||
    UI_ARTIFACT_RE.test(text) ||
    /^svg\p{L}*/iu.test(text) ||
    /\bdiagram\s+insert\s+diagram\b/i.test(text);
}

export function isQualifiedTermLabel(value: string): boolean {
  const term = cleanTerm(value);
  const words = term.split(/\s+/).filter(Boolean);
  return isValidConcept(term) &&
    words.length <= 7 &&
    !SUBORDINATE_TERM_RE.test(term) &&
    !TERM_VERB_RE.test(term) &&
    !/^(?:lecture\s+note|student\s+presentation\s+template|key\s+points?|main\s+concepts?|key\s+takeaways?)$/i.test(term) &&
    !/^slide\s+\d+/i.test(term) &&
    !/\b(?:insert|placeholder)\b/i.test(term);
}

function isQualifiedConceptLabel(value: string): boolean {
  const normalized = normaliseForMatching(value);
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length <= 7 &&
    !SUBORDINATE_TERM_RE.test(value) &&
    !/\b(?:insert|placeholder|complete\s+domain|requirements\s+business\s+rules)\b/i.test(value) &&
    !hasRepeatedWord(words);
}

function hasRepeatedWord(words: string[]): boolean {
  return words.some((word, index) => index > 0 && words[index - 1] === word);
}

function sentenceContaining(text: string, term: string): string | null {
  const lowerTerm = term.toLowerCase();
  return splitTextUnits(text)
    .map((unit) => unit.text)
    .find((unit) => unit.toLowerCase().includes(lowerTerm)) ?? null;
}

function phraseFrequency(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length ?? 0;
}

function extractNumericTokens(value: string): string[] {
  return value.match(/-?\d+(?:[.,]\d+)*(?:%|\b)/g) ?? [];
}

function detectSourceLanguage(text: string): string {
  const myanmar = text.match(/\p{Script=Myanmar}/gu)?.length ?? 0;
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (myanmar > latin * 1.5) return "my";
  if (latin > 0) return "en";
  return "und";
}

function cleanTerm(value: string): string {
  return normaliseText(value)
    .replace(/^[-–—:;,\s]+/, "")
    .replace(/[.:;,]+$/, "")
    .trim();
}

function normaliseText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normaliseForMatching(value: string): string {
  return normaliseText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.%+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeId(value: string): string {
  return normaliseForMatching(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

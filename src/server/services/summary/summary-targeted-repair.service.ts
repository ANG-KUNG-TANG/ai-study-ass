import { z } from "zod";
import type {
  AtomicFact,
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import { NOTE_RULES } from "@/server/entities/note.entity";
import { isValidConcept } from "@/server/intelligence/reliability/concept-validator";
import type { ReliableSymbolicSummary } from "@/server/services/summary/reliable-summary.service";
import type {
  SummaryArtifactForValidation,
  SummaryQualityReport,
} from "@/server/services/summary/summary-quality.service";
import type { GroundedEvidenceRequest } from "@/server/services/evidence-retriever.service";
import type { SummaryMode } from "@/types/summary";

const COVERAGE_CODES = new Set([
  "LOW_MAJOR_FACT_COVERAGE",
  "LOW_SECTION_COVERAGE",
  "LOW_CONCEPT_COVERAGE",
]);

const summaryRepairPatchSchema = z.object({
  overviewAdditions: z.array(z.string()).default([]),
  keyPoints: z.array(z.string()).default([]),
  importantConcepts: z.array(z.string()).default([]),
}).strict();

export interface SummaryRepairPatch {
  overviewAdditions: string[];
  keyPoints: string[];
  importantConcepts: string[];
}

export interface SummaryRepairPlan {
  needed: boolean;
  gaps: string[];
  evidenceRequest: GroundedEvidenceRequest;
}

export function buildSummaryRepairPlan(input: {
  grounding: GroundedKnowledge;
  artifact: SummaryArtifactForValidation;
  quality: SummaryQualityReport;
  mode: SummaryMode;
}): SummaryRepairPlan {
  const { grounding, artifact, quality, mode } = input;
  const issueCodes = new Set(
    quality.issues
      .filter((issue) => COVERAGE_CODES.has(issue.code))
      .map((issue) => issue.code),
  );

  const needed =
    mode === "comprehensive" &&
    quality.faithful &&
    !quality.coverageSufficient &&
    issueCodes.size > 0;

  if (!needed) {
    return {
      needed: false,
      gaps: [],
      evidenceRequest: { maxCharacters: 7_000, maxFacts: 16 },
    };
  }

  const artifactText = [
    artifact.summary,
    ...artifact.keyPoints,
    ...artifact.importantConcepts,
  ].join("\n");

  const supportedFacts = grounding.facts
    .filter((fact) => fact.verificationStatus === "supported")
    .sort((left, right) => right.importanceScore - left.importanceScore);

  const factIds = issueCodes.has("LOW_MAJOR_FACT_COVERAGE")
    ? supportedFacts
        .filter((fact) => !factIsRepresented(fact, artifactText))
        .slice(0, 8)
        .map((fact) => fact.id)
    : [];

  const sectionIds = issueCodes.has("LOW_SECTION_COVERAGE")
    ? grounding.sections
        .filter((section) => section.status === "covered")
        .filter((section) => {
          const sectionFacts = section.factIds
            .map((id) => supportedFacts.find((fact) => fact.id === id))
            .filter((fact): fact is AtomicFact => Boolean(fact));
          return !sectionFacts.some((fact) => factIsRepresented(fact, artifactText));
        })
        .slice(0, 8)
        .map((section) => section.sectionId)
    : [];

  const conceptNames = issueCodes.has("LOW_CONCEPT_COVERAGE")
    ? grounding.concepts
        .filter((concept) => !conceptIsRepresented(concept.name, artifactText))
        .slice(0, 8)
        .map((concept) => concept.name)
    : [];

  return {
    needed: true,
    gaps: [...issueCodes],
    evidenceRequest: {
      factIds,
      sectionIds,
      conceptNames,
      queryTerms: conceptNames,
      maxCharacters: 7_000,
      maxFacts: 16,
    },
  };
}

export function parseSummaryRepairPatch(rawText: string): SummaryRepairPatch {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/iu, "")
    .replace(/```\s*$/u, "");
  return summaryRepairPatchSchema.parse(JSON.parse(cleaned));
}

export function validateSummaryRepairPatch(
  patch: SummaryRepairPatch,
  evidenceText: string,
): SummaryRepairPatch | null {
  const overviewAdditions = unique(
    patch.overviewAdditions.filter((item) =>
      item.trim().length >= 30 &&
      item.trim().length <= 500 &&
      isGroundedText(item, evidenceText)
    ),
    3,
  );
  const keyPoints = unique(
    patch.keyPoints.filter((item) =>
      item.trim().length >= 18 &&
      item.trim().length <= 420 &&
      isGroundedText(item, evidenceText)
    ),
    6,
  );
  const importantConcepts = unique(
    patch.importantConcepts.filter((concept) =>
      isValidConcept(concept) &&
      conceptIsRepresented(concept, evidenceText)
    ),
    6,
  );

  if (
    overviewAdditions.length === 0 &&
    keyPoints.length === 0 &&
    importantConcepts.length === 0
  ) {
    return null;
  }

  return { overviewAdditions, keyPoints, importantConcepts };
}

export function applySummaryRepairPatch(
  symbolic: ReliableSymbolicSummary,
  patch: SummaryRepairPatch,
): ReliableSymbolicSummary {
  let summary = symbolic.summary;

  for (const addition of patch.overviewAdditions) {
    summary = applyIfFits(
      summary,
      (value) => appendOverview(value, addition),
    );
  }
  for (const point of patch.keyPoints) {
    summary = applyIfFits(
      summary,
      (value) => appendBulletToSection(value, "Key Points", point),
    );
  }
  for (const concept of patch.importantConcepts) {
    summary = applyIfFits(
      summary,
      (value) => appendBulletToSection(value, "Main Concepts", concept),
    );
  }

  const keyPoints = unique([...symbolic.keyPoints, ...patch.keyPoints], 14);
  const importantConcepts = unique(
    [...symbolic.importantConcepts, ...patch.importantConcepts].filter(isValidConcept),
    18,
  );
  const confidence = Math.min(0.97, symbolic.confidence + 0.02);

  return {
    ...symbolic,
    summary,
    keyPoints,
    importantConcepts,
    confidence,
    status:
      confidence >= 0.85 && symbolic.profile?.status !== "rejected"
        ? "ready"
        : symbolic.status,
  };
}

export function isSummaryRepairImprovement(
  before: SummaryQualityReport,
  after: SummaryQualityReport,
): boolean {
  if (!after.faithful) return false;
  if (after.coverageSufficient && !before.coverageSufficient) return true;

  return coverageMissingCount(after) < coverageMissingCount(before) &&
    after.metrics.unsupportedFactualUnitCount <=
      before.metrics.unsupportedFactualUnitCount &&
    after.metrics.unsupportedNumericUnitCount <=
      before.metrics.unsupportedNumericUnitCount;
}

function coverageMissingCount(report: SummaryQualityReport): number {
  return Math.max(0, report.metrics.majorFactTargetCount - report.metrics.majorFactCoveredCount) +
    Math.max(0, report.metrics.requiredSectionCount - report.metrics.representedSectionCount) +
    Math.max(0, report.metrics.conceptTargetCount - report.metrics.conceptCoveredCount);
}

function factIsRepresented(fact: AtomicFact, artifactText: string): boolean {
  return textOverlap(fact.content, artifactText) >= 0.55 ||
    fact.evidence.some((item) => textOverlap(item.text, artifactText) >= 0.55);
}

function conceptIsRepresented(concept: string, artifactText: string): boolean {
  const needle = normalise(concept);
  const haystack = normalise(artifactText);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  return textOverlap(concept, artifactText) >= 0.8;
}

function isGroundedText(candidate: string, evidenceText: string): boolean {
  const numericTokens = extractNumericTokens(candidate);
  const sourceNumbers = extractNumericTokens(evidenceText);
  if ([...numericTokens].some((token) => !sourceNumbers.has(token))) {
    return false;
  }

  const normalizedCandidate = normalise(candidate);
  const normalizedEvidence = normalise(evidenceText);
  if (normalizedCandidate && normalizedEvidence.includes(normalizedCandidate)) {
    return true;
  }

  return textOverlap(candidate, evidenceText) >= 0.45;
}

function textOverlap(candidate: string, source: string): number {
  const candidateTokens = meaningfulTokens(candidate);
  if (candidateTokens.size === 0) return 0;
  const sourceTokens = meaningfulTokens(source);
  const matched = [...candidateTokens].filter((token) => sourceTokens.has(token)).length;
  return matched / candidateTokens.size;
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    (normalise(value).match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu) ?? [])
      .filter((token) => token.length >= 2),
  );
}

function extractNumericTokens(value: string): Set<string> {
  return new Set(
    (value.match(/[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu) ?? [])
      .map((item) => item.replace(/\s+/gu, "").replace(/,(?=\d{3}(?:\D|$))/gu, "")),
  );
}

function appendOverview(markdown: string, addition: string): string {
  const expression = /(## Overview\s*\n+)([\s\S]*?)(?=\n\n## |$)/u;
  if (!expression.test(markdown)) return markdown;
  return markdown.replace(
    expression,
    (_match, heading: string, body: string) =>
      `${heading}${body.trim()} ${addition.trim()}`,
  );
}

function appendBulletToSection(
  markdown: string,
  heading: string,
  item: string,
): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(
    `(## ${escaped}\\s*\\n+)([\\s\\S]*?)(?=\\n\\n## |$)`,
    "u",
  );
  const bullet = `- ${item.trim()}`;

  if (expression.test(markdown)) {
    return markdown.replace(
      expression,
      (_match, sectionHeading: string, body: string) =>
        `${sectionHeading}${body.trim()}\n${bullet}`,
    );
  }

  return `${markdown.trim()}\n\n## ${heading}\n\n${bullet}`;
}

function applyIfFits(
  current: string,
  mutate: (value: string) => string,
): string {
  const candidate = mutate(current);
  return candidate.length <= NOTE_RULES.SUMMARY_MAX ? candidate : current;
}

function unique(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = value.replace(/\s+/gu, " ").trim();
    const key = normalise(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
    if (output.length >= limit) break;
  }

  return output;
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+., -]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

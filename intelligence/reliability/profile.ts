import type { RawDocument, SectionedDocument } from "../pipeline/types";
import type {
  ConfidenceBreakdown,
  KnowledgeCore,
  KnowledgeExtras,
  NLPResult,
} from "../types";
import { classifyDocument } from "./document-classifier";
import { resolveDocumentTitle } from "./title-resolver";
import {
  extractValidatedConcepts,
  extractValidatedKeyTerms,
} from "./concept-validator";
import { extractFinancialCaseStudy } from "./financial-case-extractor";
import { extractRequirementsDocument } from "./requirements-extractor";
import { evaluateCoverage } from "./coverage-evaluator";
import { cleanTextReliably } from "./text-quality";
import type { ReliableDocumentProfile } from "./types";

export interface ReliableKnowledgeExtras extends KnowledgeExtras {
  reliableProfile?: ReliableDocumentProfile;
}

function defaultExtras(): KnowledgeExtras {
  return {
    metric: null,
    limitations: null,
    futureWork: null,
    topic: null,
    keywords: [],
  };
}

function unique(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = value.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
    if (output.length >= limit) break;
  }

  return output;
}

export function buildReliableProfile(input: {
  raw: RawDocument;
  document: SectionedDocument;
  nlp: NLPResult;
  core: KnowledgeCore;
}): ReliableDocumentProfile {
  const cleanResult = cleanTextReliably(input.raw.rawText);
  const classification = classifyDocument(input.document.cleanText);
  const title = resolveDocumentTitle(input.raw, input.document, classification);
  const concepts = extractValidatedConcepts(
    input.document.cleanText,
    input.nlp,
    classification,
  );
  const keyTerms = extractValidatedKeyTerms(input.document.cleanText, concepts);
  const caseStudy =
    classification.kind === "case_study" && classification.domain === "finance"
      ? extractFinancialCaseStudy(input.document.cleanText, input.raw.rawText)
      : null;
  const requirementsDocument =
    classification.taskType === "business_requirements_analysis"
      ? extractRequirementsDocument(input.document)
      : null;

  const coverage = evaluateCoverage({
    text: input.document.cleanText,
    classification,
    title,
    textQuality: cleanResult.quality,
    concepts,
    caseStudy,
    requirementsDocument,
    core: input.core,
    nlp: input.nlp,
  });

  const warnings = unique(
    [
      ...cleanResult.quality.warnings,
      ...coverage.criticalWarnings,
      ...coverage.missingFields.map((field) => `Missing coverage: ${field}.`),
      ...(caseStudy?.unresolvedAssumptions ?? []),
    ],
    20,
  );

  return {
    title,
    classification,
    textQuality: cleanResult.quality,
    concepts,
    keyTerms,
    caseStudy,
    requirementsDocument,
    coverage,
    qualityScore: coverage.score,
    qualityScoreOutOf10: Number((coverage.score * 10).toFixed(2)),
    status: coverage.status,
    warnings,
    cleanedText: input.document.cleanText,
  };
}

export function attachReliableProfile(
  core: KnowledgeCore,
  profile: ReliableDocumentProfile,
): KnowledgeCore {
  const extras = (core.extras ?? defaultExtras()) as ReliableKnowledgeExtras;
  extras.reliableProfile = profile;
  extras.topic = profile.classification.domain;
  extras.keywords = unique(
    [
      ...profile.concepts.map((concept) => concept.term),
      ...extras.keywords,
    ],
    20,
  );

  core.extras = extras;

  if (profile.caseStudy) {
    core.method = profile.caseStudy.method;
    core.problem = profile.caseStudy.decisionProblem ?? core.problem;

    core.keyPoints = unique(
      [
        ...profile.caseStudy.financialInputs.slice(0, 8).map(
          (input) => `${input.label}: ${input.unit === "USD" ? "$" : ""}${input.value.toLocaleString()}${input.unit === "percent" ? "%" : ""}`,
        ),
        ...profile.caseStudy.requiredCalculations.map((value) => `Required analysis: ${value}`),
        ...core.keyPoints.map((point) => `${point.label}: ${point.value}`),
      ],
      14,
    ).map((value) => {
      const separator = value.indexOf(":");
      return separator > 0
        ? { label: value.slice(0, separator), value: value.slice(separator + 1).trim() }
        : { label: "Key Point", value };
    });
  }

  if (profile.requirementsDocument) {
    core.keyPoints = unique(
      [
        ...core.keyPoints
          .filter((point) => !/objective|key definition/i.test(point.label))
          .map((point) => `${point.label}: ${point.value}`),
        ...profile.requirementsDocument.objectives.slice(0, 4).map((value) => `Business objective: ${value}`),
        ...profile.requirementsDocument.requirements.slice(0, 5).map(
          (requirement) => `${requirement.id}${requirement.priority ? ` (${requirement.priority})` : ""}: ${requirement.statement}`,
        ),
      ],
      12,
    ).map((value) => {
      const separator = value.indexOf(":");
      return separator > 0
        ? { label: value.slice(0, separator), value: value.slice(separator + 1).trim() }
        : { label: "Key Point", value };
    });
  }

  core.entities = unique(
    [
      ...profile.concepts.map((concept) => concept.term),
      ...(profile.requirementsDocument?.actors ?? []),
      ...(profile.requirementsDocument?.diagramTypes ?? []),
      ...core.entities,
    ],
    24,
  );

  return core;
}

export function getReliableProfile(
  core: KnowledgeCore | null | undefined,
): ReliableDocumentProfile | null {
  const extras = core?.extras as ReliableKnowledgeExtras | undefined;
  return extras?.reliableProfile ?? null;
}

export function calibrateConfidenceBreakdown<
  T extends Pick<ConfidenceBreakdown, "overall" | "overallOutOf10"> & {
    coverage?: number;
  },
>(
  breakdown: T,
  profile: ReliableDocumentProfile | null,
): T {
  if (!profile) return breakdown;

  const calibratedCoverage = Math.min(
    breakdown.coverage ?? profile.coverage.score,
    profile.coverage.score,
  );

  let overall = clamp(
    breakdown.overall * 0.58 +
      profile.qualityScore * 0.42,
  );

  if (profile.status === "partial") overall = Math.min(overall, 0.84);
  if (profile.status === "rejected") overall = Math.min(overall, 0.59);
  if (!profile.textQuality.passed) overall = Math.min(overall, 0.54);

  return {
    ...breakdown,
    ...(breakdown.coverage !== undefined ? { coverage: calibratedCoverage } : {}),
    overall,
    overallOutOf10: overall * 10,
  } as T;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

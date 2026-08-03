import type { KnowledgeCore, NLPResult } from "../types";
import type {
  CaseStudyProfile,
  CoverageReport,
  DocumentClassification,
  ResolvedTitle,
  StudyConcept,
  TextQualityReport,
} from "./types";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function financialCaseCoverage(
  text: string,
  caseStudy: CaseStudyProfile,
): { required: string[]; present: string[] } {
  const lower = text.toLowerCase();
  const inputs = caseStudy.financialInputs;
  const has = (predicate: (label: string) => boolean): boolean =>
    inputs.some((input) => predicate(input.label.toLowerCase()));

  const checks: Array<[string, boolean]> = [
    ["decisionProblem", Boolean(caseStudy.decisionProblem)],
    ["initialInvestment", inputs.filter((input) => input.unit === "USD" && input.frequency === "once").length >= 2],
    ["revenueAssumptions", has((label) => label.includes("selling price")) && has((label) => label.includes("barrels per seat"))],
    ["operatingCosts", inputs.filter((input) => input.unit === "USD" && ["monthly", "yearly"].includes(input.frequency)).length >= 2],
    ["taxRate", has((label) => label.includes("tax rate"))],
    ["projectLife", has((label) => label.includes("project life"))],
    ["costOfCapital", has((label) => label.includes("cost of capital"))],
    ["bestCase", caseStudy.scenarios.some((scenario) => /best/i.test(scenario.name))],
    ["worstCase", caseStudy.scenarios.some((scenario) => /worst/i.test(scenario.name))],
    ["npv", /\bnpv\b|net present value/.test(lower)],
    ["irr", /\birr\b|internal rate of return/.test(lower)],
  ];

  return {
    required: checks.map(([field]) => field),
    present: checks.filter(([, isPresent]) => isPresent).map(([field]) => field),
  };
}

function generalCoverage(
  classification: DocumentClassification,
  core: KnowledgeCore,
  nlp: NLPResult,
): { required: string[]; present: string[] } {
  const checks: Array<[string, boolean]> = classification.kind === "research_paper"
    ? [
        ["problem", Boolean(core.problem)],
        ["method", Boolean(core.method)],
        ["evidence", nlp.topSentences.length >= 2],
        ["concepts", core.entities.length >= 3 || (core.extras?.keywords.length ?? 0) >= 5],
        ["findings", core.accuracy !== null || core.keyPoints.length >= 2],
        ["limitations", Boolean(core.extras?.limitations)],
      ]
    : [
        ["overview", Boolean(core.problem) || nlp.topSentences.length >= 1],
        ["concepts", core.entities.length >= 3 || (core.extras?.keywords.length ?? 0) >= 5],
        ["keyPoints", core.keyPoints.length >= 2 || nlp.topSentences.length >= 3],
      ];

  return {
    required: checks.map(([field]) => field),
    present: checks.filter(([, isPresent]) => isPresent).map(([field]) => field),
  };
}

function conceptQuality(concepts: StudyConcept[]): number {
  if (concepts.length === 0) return 0;
  const average = concepts.reduce((sum, concept) => sum + concept.confidence, 0) / concepts.length;
  return clamp(average * 0.72 + Math.min(concepts.length / 12, 1) * 0.28);
}

function groundingScore(concepts: StudyConcept[], caseStudy: CaseStudyProfile | null): number {
  const conceptEvidence = concepts.length === 0
    ? 0
    : concepts.filter((concept) => Boolean(concept.evidence)).length / concepts.length;
  const numericEvidence = caseStudy
    ? caseStudy.financialInputs.filter((input) => input.evidence.length >= 10).length /
      Math.max(1, caseStudy.financialInputs.length)
    : 1;
  return clamp(conceptEvidence * 0.55 + numericEvidence * 0.45);
}

function numericValidationScore(caseStudy: CaseStudyProfile | null): number {
  if (!caseStudy) return 0.82;
  const inputCount = caseStudy.financialInputs.length;
  const derivedCount = caseStudy.derivedCalculations.length;
  const validInputs = caseStudy.financialInputs.filter(
    (input) => Number.isFinite(input.value) && input.confidence >= 0.75,
  ).length;
  return clamp(
    (validInputs / Math.max(1, inputCount)) * 0.55 +
      Math.min(inputCount / 12, 1) * 0.3 +
      Math.min(derivedCount / 5, 1) * 0.15,
  );
}

function consistencyScore(
  concepts: StudyConcept[],
  caseStudy: CaseStudyProfile | null,
): number {
  const uniqueConcepts = new Set(concepts.map((concept) => concept.normalized)).size;
  const conceptConsistency = concepts.length === 0 ? 0 : uniqueConcepts / concepts.length;
  const unresolvedPenalty = Math.min(0.35, (caseStudy?.unresolvedAssumptions.length ?? 0) * 0.08);
  return clamp(conceptConsistency - unresolvedPenalty + 0.12);
}

export function evaluateCoverage(input: {
  text: string;
  classification: DocumentClassification;
  title: ResolvedTitle;
  textQuality: TextQualityReport;
  concepts: StudyConcept[];
  caseStudy: CaseStudyProfile | null;
  core: KnowledgeCore;
  nlp: NLPResult;
}): CoverageReport {
  const structural = input.caseStudy && input.classification.domain === "finance"
    ? financialCaseCoverage(input.text, input.caseStudy)
    : generalCoverage(input.classification, input.core, input.nlp);

  const missing = structural.required.filter((field) => !structural.present.includes(field));
  const structuralCoverage = structural.present.length / Math.max(1, structural.required.length);
  const titleQuality = clamp(input.title.confidence - (input.title.value === "Generated Study Notes" ? 0.25 : 0));
  const concepts = conceptQuality(input.concepts);
  const grounding = groundingScore(input.concepts, input.caseStudy);
  const numericValidation = numericValidationScore(input.caseStudy);
  const consistency = consistencyScore(input.concepts, input.caseStudy);
  const sectionCoverage = input.classification.kind === "case_study"
    ? structuralCoverage
    : clamp(
        Number(input.nlp.sentences.length >= 5) * 0.35 +
          Number(input.core.problem !== null) * 0.2 +
          Number(input.core.method !== null) * 0.2 +
          Math.min(input.nlp.topSentences.length / 5, 1) * 0.25,
      );

  const score = clamp(
    input.textQuality.score * 0.18 +
      titleQuality * 0.1 +
      concepts * 0.12 +
      structuralCoverage * 0.22 +
      grounding * 0.13 +
      numericValidation * 0.1 +
      consistency * 0.07 +
      sectionCoverage * 0.08,
  );

  const criticalWarnings: string[] = [];
  if (!input.textQuality.passed) criticalWarnings.push("The extracted text did not pass the encoding/readability gate.");
  if (titleQuality < 0.65) criticalWarnings.push("The document title could not be resolved confidently.");
  if (input.classification.kind === "case_study" && !structural.present.includes("decisionProblem")) {
    criticalWarnings.push("The case-study decision problem is missing.");
  }
  if (input.classification.domain === "finance" && missing.includes("npv")) {
    criticalWarnings.push("NPV coverage is missing from the finance case.");
  }
  if (input.classification.domain === "finance" && missing.includes("irr")) {
    criticalWarnings.push("IRR coverage is missing from the finance case.");
  }

  const status =
    criticalWarnings.some((warning) => warning.includes("encoding/readability")) || score < 0.55
      ? "rejected"
      : score >= 0.85 && missing.length <= 1
        ? "ready"
        : "partial";

  return {
    score,
    status,
    requiredFields: structural.required,
    presentFields: structural.present,
    missingFields: missing,
    criticalWarnings,
    componentScores: {
      textQuality: input.textQuality.score,
      titleQuality,
      conceptQuality: concepts,
      structuralCoverage,
      grounding,
      numericValidation,
      consistency,
      sectionCoverage,
    },
  };
}

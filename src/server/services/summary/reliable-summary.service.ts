import type { KnowledgeCore } from "@/server/intelligence/types";
import {
  getReliableProfile,
} from "@/server/intelligence/reliability/profile";
import {
  cleanTextReliably,
  corruptedCharacterRatio,
  greekCharacterRatio,
} from "@/server/intelligence/reliability/text-quality";
import {
  isValidConcept,
} from "@/server/intelligence/reliability/concept-validator";
import type {
  FinancialInput,
  ReliableDocumentProfile,
  ReliabilityStatus,
} from "@/server/intelligence/reliability/types";

const MAX_SUMMARY_CHARS = 24_000;

export interface ReliableSymbolicSummary {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
  confidence: number;
  status: "ready" | "partial";
  profile: ReliableDocumentProfile | null;
}

export interface AIStudyNotesDraft {
  overview: string;
  keyPoints: string[];
  importantConcepts: string[];
  keyTerms?: Array<{
    term: string;
    definition: string;
  }>;
  unresolvedAssumptions?: string[];
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

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatFinancialValue(input: FinancialInput): string {
  const value = formatNumber(input.value);
  if (input.unit === "USD") return `$${value}`;
  if (input.unit === "percent") return `${value}%`;
  return `${value} ${input.unit}`;
}

function financialTable(inputs: FinancialInput[]): string {
  if (inputs.length === 0) return "";

  return [
    "| Item | Amount / assumption | Frequency |",
    "| --- | ---: | --- |",
    ...inputs.map(
      (input) =>
        `| ${input.label} | ${formatFinancialValue(input)} | ${input.frequency} |`,
    ),
  ].join("\n");
}

function generatedTitleNotice(profile: ReliableDocumentProfile): string {
  return profile.title.generated
    ? "> *Generated working title based on the document content.*"
    : "";
}

function caseOverview(profile: ReliableDocumentProfile): string {
  const caseStudy = profile.caseStudy;
  if (!caseStudy) return "";

  const actorText = caseStudy.actors.length > 0
    ? `${caseStudy.actors.join(" and ")} must evaluate the proposed investment.`
    : "The case requires an investment decision.";

  return [
    actorText,
    caseStudy.decisionProblem ?? "The central question is whether the proposed project creates financial value.",
    "The analysis must use incremental project cash flows and compare alternative scenarios before making a recommendation.",
  ].join(" ");
}

function buildCaseStudySummary(
  profile: ReliableDocumentProfile,
): ReliableSymbolicSummary {
  const caseStudy = profile.caseStudy!;
  const initial = caseStudy.financialInputs.filter(
    (input) => input.unit === "USD" && input.frequency === "once",
  );
  const operating = caseStudy.financialInputs.filter(
    (input) => input.unit === "USD" && input.frequency !== "once",
  );
  const assumptions = caseStudy.financialInputs.filter(
    (input) => input.unit !== "USD",
  );
  const calculations = caseStudy.derivedCalculations;
  const keyPoints = unique(
    [
      caseStudy.decisionProblem ?? "",
      ...caseStudy.requiredCalculations.map((item) => `Required analysis: ${item}.`),
      ...calculations.map(
        (item) => `${item.label}: ${formatFinancialValue(item)} (${item.formula ?? "derived"}).`,
      ),
      ...caseStudy.unresolvedAssumptions,
    ],
    14,
  );
  const importantConcepts = unique(
    profile.concepts.map((concept) => concept.term),
    16,
  );

  const sections = [
    `# ${profile.title.value}`,
    generatedTitleNotice(profile),
    "## Overview",
    caseOverview(profile),
    "## Decision Problem",
    caseStudy.decisionProblem ?? "The decision problem could not be extracted confidently.",
    "## Analysis Method",
    caseStudy.method,
    initial.length > 0 ? "## Initial Project Investment" : "",
    financialTable(initial),
    operating.length > 0 ? "## Operating-Cost Assumptions" : "",
    financialTable(operating),
    assumptions.length > 0 ? "## Other Financial Assumptions" : "",
    financialTable(assumptions),
    calculations.length > 0 ? "## Derived Calculations" : "",
    calculations.length > 0
      ? calculations
          .map(
            (item) =>
              `- **${item.label}:** ${formatFinancialValue(item)}${item.formula ? `  \n  Formula: \`${item.formula}\`` : ""}`,
          )
          .join("\n")
      : "",
    caseStudy.scenarios.length > 0 ? "## Required Scenarios" : "",
    caseStudy.scenarios.length > 0
      ? caseStudy.scenarios
          .map(
            (scenario) =>
              `### ${scenario.name}\n${scenario.changes.map((change) => `- ${change}`).join("\n")}`,
          )
          .join("\n\n")
      : "",
    caseStudy.requiredCalculations.length > 0 ? "## Required Analyses" : "",
    caseStudy.requiredCalculations.length > 0
      ? caseStudy.requiredCalculations.map((item) => `- ${item}`).join("\n")
      : "",
    importantConcepts.length > 0 ? "## Main Concepts" : "",
    importantConcepts.length > 0
      ? importantConcepts.map((concept) => `- ${concept}`).join("\n")
      : "",
    profile.keyTerms.length > 0 ? "## Key Terms" : "",
    profile.keyTerms.length > 0
      ? profile.keyTerms
          .map((term) => `- **${term.term}:** ${term.definition}`)
          .join("\n")
      : "",
    caseStudy.unresolvedAssumptions.length > 0 ? "## Unresolved Assumptions" : "",
    caseStudy.unresolvedAssumptions.length > 0
      ? caseStudy.unresolvedAssumptions.map((item) => `- ${item}`).join("\n")
      : "",
    "## Key Takeaways",
    [
      "The decision must be based on incremental after-tax cash flows rather than revenue alone.",
      "Initial investment, working capital, depreciation, taxes, operating costs, salvage value, and terminal cash flow must be included when the source provides them.",
      "NPV changes with the cost of capital, while IRR is calculated from the project cash-flow series.",
      "Best-case, worst-case, renovation, and sensitivity scenarios should be compared rather than evaluated in isolation.",
    ]
      .map((item) => `- ${item}`)
      .join("\n"),
  ];

  const summary = sections
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_SUMMARY_CHARS)
    .trim();

  return {
    summary,
    keyPoints,
    importantConcepts,
    confidence: profile.qualityScore,
    status: profile.status === "ready" ? "ready" : "partial",
    profile,
  };
}

function buildGeneralSummary(
  core: KnowledgeCore | null | undefined,
  profile: ReliableDocumentProfile | null,
  sourceText: string,
  fallbackTitle: string,
): ReliableSymbolicSummary {
  const clean = cleanTextReliably(sourceText).text;
  const sentences = clean
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 420);
  const title = profile?.title.value ?? fallbackTitle;
  const overview = core?.problem ?? sentences[0] ?? `This document discusses ${title}.`;
  const concepts = unique(
    [
      ...(profile?.concepts.map((concept) => concept.term) ?? []),
      ...(core?.entities ?? []),
      ...(core?.extras?.keywords ?? []),
    ].filter(isValidConcept),
    16,
  );
  const keyPoints = unique(
    [
      ...(core?.keyPoints.map((point) => `${point.label}: ${point.value}`) ?? []),
      ...(core?.contributions ?? []),
      ...sentences.slice(1, 8),
    ],
    10,
  );

  const detailLines = [
    core?.method ? `- **Method:** ${core.method}` : "",
    core?.dataset ? `- **Dataset:** ${core.dataset}` : "",
    core?.accuracy !== null && core?.accuracy !== undefined
      ? `- **Reported result:** ${core.accuracy}%`
      : "",
    core?.extras?.metric ? `- **Metric:** ${core.extras.metric}` : "",
  ].filter(Boolean);

  const sections = [
    `# ${title}`,
    profile ? generatedTitleNotice(profile) : "",
    "## Overview",
    overview,
    detailLines.length > 0 ? "## Method and Evidence" : "",
    detailLines.join("\n"),
    keyPoints.length > 0 ? "## Key Points" : "",
    keyPoints.map((point) => `- ${point}`).join("\n"),
    concepts.length > 0 ? "## Main Concepts" : "",
    concepts.map((concept) => `- ${concept}`).join("\n"),
    profile?.keyTerms.length ? "## Key Terms" : "",
    profile?.keyTerms.length
      ? profile.keyTerms.map((term) => `- **${term.term}:** ${term.definition}`).join("\n")
      : "",
    core?.extras?.limitations ? "## Limitations" : "",
    core?.extras?.limitations ?? "",
    core?.extras?.futureWork ? "## Future Work" : "",
    core?.extras?.futureWork ?? "",
    "## Key Takeaways",
    sentences.slice(0, 5).map((sentence) => `- ${sentence}`).join("\n"),
  ];

  const summary = sections
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_SUMMARY_CHARS)
    .trim();
  const confidence = profile?.qualityScore ?? Math.min(0.72, 0.35 + keyPoints.length * 0.045 + concepts.length * 0.02);

  return {
    summary,
    keyPoints,
    importantConcepts: concepts,
    confidence,
    status: confidence >= 0.85 && keyPoints.length >= 3 ? "ready" : "partial",
    profile,
  };
}

export function buildReliableSymbolicSummary(
  core: KnowledgeCore | null | undefined,
  sourceText: string,
  fallbackTitle: string,
): ReliableSymbolicSummary {
  const profile = getReliableProfile(core);

  if (profile?.caseStudy && profile.classification.domain === "finance") {
    return buildCaseStudySummary(profile);
  }

  return buildGeneralSummary(core, profile, sourceText, fallbackTitle);
}

function meaningfulTokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{3,}/g)
      ?.filter((token) => !["this", "that", "these", "those", "with", "from", "have", "will"].includes(token)) ?? [],
  );
}

export function groundingRatio(candidate: string, sourceText: string): number {
  const candidateTokens = meaningfulTokenSet(candidate);
  if (candidateTokens.size === 0) return 0;
  const sourceTokens = meaningfulTokenSet(sourceText);
  const grounded = [...candidateTokens].filter((token) => sourceTokens.has(token)).length;
  return grounded / candidateTokens.size;
}

export function validateAIDraft(
  draft: AIStudyNotesDraft,
  sourceText: string,
): AIStudyNotesDraft | null {
  const overview = draft.overview?.trim();
  if (!overview || overview.length < 80 || overview.length > 1_500) return null;
  if (corruptedCharacterRatio(overview) > 0.03 || greekCharacterRatio(overview) > 0.12) return null;
  if (groundingRatio(overview, sourceText) < 0.36) return null;

  const keyPoints = unique(
    (draft.keyPoints ?? []).filter(
      (item) => item.length >= 18 && groundingRatio(item, sourceText) >= 0.32,
    ),
    10,
  );
  const importantConcepts = unique(
    (draft.importantConcepts ?? []).filter(isValidConcept),
    14,
  );

  if (keyPoints.length < 2 || importantConcepts.length < 2) return null;

  return {
    overview,
    keyPoints,
    importantConcepts,
    keyTerms: (draft.keyTerms ?? []).filter(
      (item) =>
        isValidConcept(item.term) &&
        item.definition.length >= 20 &&
        groundingRatio(`${item.term} ${item.definition}`, sourceText) >= 0.28,
    ),
    unresolvedAssumptions: unique(draft.unresolvedAssumptions ?? [], 8),
  };
}

export function mergeAIDraft(
  symbolic: ReliableSymbolicSummary,
  draft: AIStudyNotesDraft,
): ReliableSymbolicSummary {
  const keyPoints = unique([...symbolic.keyPoints, ...draft.keyPoints], 14);
  const importantConcepts = unique(
    [...symbolic.importantConcepts, ...draft.importantConcepts].filter(isValidConcept),
    18,
  );

  const summary = symbolic.summary.replace(
    /## Overview\n\n[\s\S]*?(?=\n\n## )/,
    `## Overview\n\n${draft.overview}`,
  );

  const profileStatus: ReliabilityStatus = symbolic.profile?.status ?? "partial";
  const confidence = Math.min(
    0.97,
    symbolic.confidence + (profileStatus === "ready" ? 0.035 : 0.015),
  );

  return {
    ...symbolic,
    summary,
    keyPoints,
    importantConcepts,
    confidence,
    status: confidence >= 0.85 && profileStatus !== "rejected" ? "ready" : "partial",
  };
}

export function isReliableCachedSummary(summary: string): boolean {
  const trimmed = summary.trim();
  if (trimmed.length < 350) return false;
  if (corruptedCharacterRatio(trimmed) > 0.035 || greekCharacterRatio(trimmed) > 0.12) return false;
  if (/Case Study Series\s+Case Study Series/i.test(trimmed)) return false;
  if (/^#?\s*(untitled|case|study)\s*$/im.test(trimmed)) return false;
  return /##\s+(Overview|Decision Problem|Key Points|Main Concepts)/i.test(trimmed);
}

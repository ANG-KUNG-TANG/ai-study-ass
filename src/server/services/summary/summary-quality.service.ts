import type {
  AtomicFact,
  GroundedKnowledge,
  SectionCoverage,
} from "@/server/intelligence/grounding";
import type { SummaryMode } from "@/types/summary";

export type SummaryQualityStatus = "passed" | "warning" | "failed";
export type SummaryQualitySeverity = "warning" | "error";

export type SummaryQualityIssueCode =
  | "UNSUPPORTED_FACTUAL_CONTENT"
  | "UNSUPPORTED_NUMERIC_CONTENT"
  | "LOW_MAJOR_FACT_COVERAGE"
  | "LOW_SECTION_COVERAGE"
  | "LOW_CONCEPT_COVERAGE";

export interface SummaryQualityIssue {
  code: SummaryQualityIssueCode;
  severity: SummaryQualitySeverity;
  message: string;
}

export interface SummaryQualityMetrics {
  factualUnitCount: number;
  supportedFactualUnitCount: number;
  unsupportedFactualUnitCount: number;
  unsupportedNumericUnitCount: number;
  majorFactTargetCount: number;
  majorFactCoveredCount: number;
  requiredSectionCount: number;
  representedSectionCount: number;
  conceptTargetCount: number;
  conceptCoveredCount: number;
}

export interface SummaryQualityReport {
  status: SummaryQualityStatus;
  faithful: boolean;
  coverageSufficient: boolean;
  issues: SummaryQualityIssue[];
  metrics: SummaryQualityMetrics;
}

export interface SummaryArtifactForValidation {
  summary: string;
  keyPoints: string[];
  importantConcepts: string[];
}

interface SupportSource {
  text: string;
  numericTokens: Set<string>;
}

interface ModePolicy {
  sectionLimit: number;
  majorFactLimit: number;
  conceptLimit: number;
  minimumMajorFactCoverage: number;
  minimumSectionCoverage: number;
  minimumConceptCoverage: number;
}

const MODE_POLICIES: Record<SummaryMode, ModePolicy> = {
  concise: {
    sectionLimit: 8,
    majorFactLimit: 6,
    conceptLimit: 8,
    minimumMajorFactCoverage: 0.60,
    minimumSectionCoverage: 0.75,
    minimumConceptCoverage: 0.75,
  },
  comprehensive: {
    sectionLimit: Number.POSITIVE_INFINITY,
    majorFactLimit: 12,
    conceptLimit: 16,
    minimumMajorFactCoverage: 0.75,
    minimumSectionCoverage: 0.90,
    minimumConceptCoverage: 0.80,
  },
  exam: {
    sectionLimit: 12,
    majorFactLimit: 10,
    conceptLimit: 12,
    minimumMajorFactCoverage: 0.65,
    minimumSectionCoverage: 0.75,
    minimumConceptCoverage: 0.75,
  },
};

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
  "for", "from", "has", "have", "in", "into", "is", "it", "of", "on",
  "or", "that", "the", "their", "these", "this", "those", "to", "was",
  "were", "will", "with",
]);

const EXAM_FACT_TYPES = new Set<AtomicFact["type"]>([
  "definition",
  "objective",
  "rule",
  "condition",
  "formula",
  "number",
  "result",
  "relationship",
  "warning",
  "common_mistake",
]);

const GENERIC_NON_FACT_PATTERNS = [
  /^these notes (?:organise|organize) the verified knowledge extracted from\b/i,
  /^generated working title based on the document content\b/i,
];

export function assessSummaryQuality(input: {
  artifact: SummaryArtifactForValidation;
  grounding: GroundedKnowledge;
  mode: SummaryMode;
}): SummaryQualityReport {
  const { artifact, grounding, mode } = input;
  const policy = MODE_POLICIES[mode];

  const supportedFacts = grounding.facts.filter(
    (fact) => fact.verificationStatus === "supported",
  );
  const supportSources = buildSupportSources(grounding, supportedFacts);
  const factualUnits = extractFactualUnits(artifact);

  const supportedUnits: string[] = [];
  const unsupportedUnits: string[] = [];
  const unsupportedNumericUnits: string[] = [];

  for (const unit of factualUnits) {
    if (isGenericNonFact(unit)) continue;

    const support = bestSupport(unit, supportSources);
    if (support.supported) {
      supportedUnits.push(unit);
    } else {
      unsupportedUnits.push(unit);
      if (extractNumericTokens(unit).size > 0) {
        unsupportedNumericUnits.push(unit);
      }
    }
  }

  const majorFacts = selectMajorFacts(
    supportedFacts,
    mode,
    policy.majorFactLimit,
  );
  const majorFactCoveredCount = majorFacts.filter((fact) =>
    factIsRepresented(fact, artifact.summary, factualUnits)
  ).length;

  const requiredSections = selectRequiredSections(
    grounding.sections,
    supportedFacts,
    mode,
    policy.sectionLimit,
  );
  const representedSectionCount = requiredSections.filter((section) =>
    sectionIsRepresented(section, artifact.summary, supportedFacts, factualUnits)
  ).length;

  const targetConcepts = grounding.concepts.slice(0, policy.conceptLimit);
  const representedConcepts = new Set(
    artifact.importantConcepts.map((concept) => normalise(concept)),
  );
  const normalisedSummary = normalise(artifact.summary);
  const conceptCoveredCount = targetConcepts.filter((concept) => {
    const name = normalise(concept.name);
    return Boolean(
      name &&
      (representedConcepts.has(name) || normalisedSummary.includes(name))
    );
  }).length;

  const factualUnitCount = supportedUnits.length + unsupportedUnits.length;
  const unsupportedRatio = ratio(unsupportedUnits.length, factualUnitCount, 0);
  const majorFactCoverage = ratio(
    majorFactCoveredCount,
    majorFacts.length,
    1,
  );
  const sectionCoverage = ratio(
    representedSectionCount,
    requiredSections.length,
    1,
  );
  const conceptCoverage = ratio(
    conceptCoveredCount,
    targetConcepts.length,
    1,
  );

  const issues: SummaryQualityIssue[] = [];

  if (unsupportedNumericUnits.length > 0) {
    issues.push({
      code: "UNSUPPORTED_NUMERIC_CONTENT",
      severity: "error",
      message:
        "The summary contains numeric content that cannot be tied to grounded source evidence.",
    });
  }

  if (unsupportedRatio > 0.25) {
    issues.push({
      code: "UNSUPPORTED_FACTUAL_CONTENT",
      severity: "error",
      message:
        "Too much factual summary content cannot be tied to supported source evidence.",
    });
  } else if (unsupportedRatio > 0.08) {
    issues.push({
      code: "UNSUPPORTED_FACTUAL_CONTENT",
      severity: "warning",
      message:
        "Some factual summary content could not be tied confidently to supported source evidence.",
    });
  }

  addCoverageIssue(
    issues,
    "LOW_MAJOR_FACT_COVERAGE",
    majorFacts.length,
    majorFactCoverage,
    policy.minimumMajorFactCoverage,
    "high-importance grounded facts",
  );
  addCoverageIssue(
    issues,
    "LOW_SECTION_COVERAGE",
    requiredSections.length,
    sectionCoverage,
    policy.minimumSectionCoverage,
    "source sections",
  );
  addCoverageIssue(
    issues,
    "LOW_CONCEPT_COVERAGE",
    targetConcepts.length,
    conceptCoverage,
    policy.minimumConceptCoverage,
    "important grounded concepts",
  );

  const hasError = issues.some((issue) => issue.severity === "error");
  const status: SummaryQualityStatus = hasError
    ? "failed"
    : issues.length > 0
      ? "warning"
      : "passed";

  const faithfulnessCodes: SummaryQualityIssueCode[] = [
    "UNSUPPORTED_FACTUAL_CONTENT",
    "UNSUPPORTED_NUMERIC_CONTENT",
  ];
  const coverageCodes: SummaryQualityIssueCode[] = [
    "LOW_MAJOR_FACT_COVERAGE",
    "LOW_SECTION_COVERAGE",
    "LOW_CONCEPT_COVERAGE",
  ];

  return {
    status,
    faithful: !issues.some(
      (issue) =>
        issue.severity === "error" &&
        faithfulnessCodes.includes(issue.code),
    ),
    coverageSufficient: !issues.some(
      (issue) =>
        issue.severity === "error" &&
        coverageCodes.includes(issue.code),
    ),
    issues,
    metrics: {
      factualUnitCount,
      supportedFactualUnitCount: supportedUnits.length,
      unsupportedFactualUnitCount: unsupportedUnits.length,
      unsupportedNumericUnitCount: unsupportedNumericUnits.length,
      majorFactTargetCount: majorFacts.length,
      majorFactCoveredCount,
      requiredSectionCount: requiredSections.length,
      representedSectionCount,
      conceptTargetCount: targetConcepts.length,
      conceptCoveredCount,
    },
  };
}

export function summaryQualityWarnings(
  report: SummaryQualityReport,
): string[] {
  return report.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);
}

export function summaryQualityLogContext(
  report: SummaryQualityReport,
): Record<string, unknown> {
  return {
    status: report.status,
    faithful: report.faithful,
    coverageSufficient: report.coverageSufficient,
    issueCodes: report.issues.map((issue) => issue.code),
    metrics: report.metrics,
  };
}

function addCoverageIssue(
  issues: SummaryQualityIssue[],
  code: SummaryQualityIssueCode,
  targetCount: number,
  actualRatio: number,
  minimumRatio: number,
  subject: string,
): void {
  if (targetCount < 2) return;

  if (actualRatio < minimumRatio * 0.65) {
    issues.push({
      code,
      severity: "error",
      message: `The summary omits too many ${subject} for the selected summary mode.`,
    });
  } else if (actualRatio < minimumRatio) {
    issues.push({
      code,
      severity: "warning",
      message: `The summary covers fewer ${subject} than expected for the selected summary mode.`,
    });
  }
}

function buildSupportSources(
  grounding: GroundedKnowledge,
  supportedFacts: AtomicFact[],
): SupportSource[] {
  const sources: SupportSource[] = [];

  for (const fact of supportedFacts) {
    addSupportSource(
      sources,
      [fact.content, ...fact.evidence.map((item) => item.text)].join(" "),
    );
  }

  for (const term of grounding.keyTerms) {
    addSupportSource(
      sources,
      [
        term.term,
        term.definition,
        ...term.evidence.map((item) => item.text),
      ].join(" "),
    );
  }

  for (const concept of grounding.concepts) {
    addSupportSource(
      sources,
      [
        concept.name,
        concept.explanation ?? "",
        ...concept.evidence.map((item) => item.text),
      ].join(" "),
    );
  }

  return sources;
}

function addSupportSource(
  sources: SupportSource[],
  text: string,
): void {
  const cleaned = stripPresentation(text);
  if (!cleaned) return;

  sources.push({
    text: cleaned,
    numericTokens: extractNumericTokens(cleaned),
  });
}

function extractFactualUnits(
  artifact: SummaryArtifactForValidation,
): string[] {
  const units = new Set<string>();

  for (const keyPoint of artifact.keyPoints) {
    addUnit(units, keyPoint);
  }

  let activeSection = "";

  for (const rawLine of artifact.summary.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || /^<!--/u.test(line)) continue;

    const heading = line.match(/^#{2,3}\s+(.+)$/u);
    if (heading) {
      activeSection = stripPresentation(heading[1] ?? "");
      continue;
    }

    if (/^#\s+/u.test(line) || /^>\s*\*/u.test(line)) continue;
    if (/^\|?\s*:?-{3,}/u.test(line)) continue;

    if (/^[-*]\s+/u.test(line)) {
      addUnit(units, line.replace(/^[-*]\s+/u, ""));
      continue;
    }

    if (/^\|\s*.+\|\s*$/u.test(line)) {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (
        cells.length > 0 &&
        !cells.every((cell) => /^:?-{3,}:?$/u.test(cell))
      ) {
        addUnit(units, cells.join(" "));
      }
      continue;
    }

    if (
      /^overview$/i.test(activeSection) ||
      /^key takeaways$/i.test(activeSection)
    ) {
      for (const sentence of splitSentences(line)) {
        addUnit(units, sentence);
      }
    }
  }

  return [...units];
}

function addUnit(units: Set<string>, raw: string): void {
  const value = stripPresentation(raw);
  if (value.length >= 4) units.add(value);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|[\r\n]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function stripPresentation(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/\*\*|__|`/gu, "")
    .replace(
      /\s*(?:\(|\[)\s*(?:p|pp)\.?\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:\)|\])\s*$/giu,
      "",
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function normalise(text: string): string {
  return stripPresentation(text)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+\-., ]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function compactNormalised(text: string): string {
  return normalise(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

function meaningfulTokens(text: string): Set<string> {
  const tokens =
    normalise(text).match(
      /[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]{1,}/gu,
    ) ?? [];

  return new Set(
    tokens.filter(
      (token) =>
        token.length >= 2 && !ENGLISH_STOP_WORDS.has(token),
    ),
  );
}

function extractNumericTokens(text: string): Set<string> {
  const matches =
    stripPresentation(text).match(
      /[-+]?\d+(?:[.,]\d+)*(?:\s*%)?/gu,
    ) ?? [];

  return new Set(
    matches.map((value) =>
      value
        .replace(/\s+/gu, "")
        .replace(/,(?=\d{3}(?:\D|$))/gu, "")
    ),
  );
}

function bestSupport(
  candidate: string,
  sources: SupportSource[],
): { supported: boolean; score: number } {
  const candidateNumbers = extractNumericTokens(candidate);
  let best = 0;

  for (const source of sources) {
    if (
      candidateNumbers.size > 0 &&
      !setIsSubset(candidateNumbers, source.numericTokens)
    ) {
      continue;
    }

    const score = similarity(candidate, source.text);
    best = Math.max(best, score);

    if (score >= supportThreshold(candidate)) {
      return { supported: true, score };
    }
  }

  return { supported: false, score: best };
}

function supportThreshold(candidate: string): number {
  const tokenCount = meaningfulTokens(candidate).size;
  if (tokenCount <= 2) return 0.92;
  if (tokenCount <= 4) return 0.72;
  return 0.55;
}

function similarity(candidate: string, source: string): number {
  const candidateNormalised = normalise(candidate);
  const sourceNormalised = normalise(source);

  if (!candidateNormalised || !sourceNormalised) return 0;
  if (sourceNormalised.includes(candidateNormalised)) return 1;

  if (
    candidateNormalised.length >= 18 &&
    candidateNormalised.includes(sourceNormalised)
  ) {
    return Math.min(
      0.96,
      sourceNormalised.length / candidateNormalised.length + 0.25,
    );
  }

  const tokenCoverage = setCoverage(
    meaningfulTokens(candidateNormalised),
    meaningfulTokens(sourceNormalised),
  );
  const gramCoverage = characterGramCoverage(
    compactNormalised(candidateNormalised),
    compactNormalised(sourceNormalised),
    3,
  );

  return Math.max(tokenCoverage, gramCoverage * 0.90);
}

function characterGramCoverage(
  candidate: string,
  source: string,
  width: number,
): number {
  if (candidate.length < width || source.length < width) {
    return candidate === source ? 1 : 0;
  }

  return setCoverage(
    grams(candidate, width),
    grams(source, width),
  );
}

function grams(text: string, width: number): Set<string> {
  const output = new Set<string>();
  for (let index = 0; index <= text.length - width; index += 1) {
    output.add(text.slice(index, index + width));
  }
  return output;
}

function setCoverage(
  candidate: Set<string>,
  source: Set<string>,
): number {
  if (candidate.size === 0) return 0;

  let matches = 0;
  for (const value of candidate) {
    if (source.has(value)) matches += 1;
  }

  return matches / candidate.size;
}

function setIsSubset(
  candidate: Set<string>,
  source: Set<string>,
): boolean {
  for (const value of candidate) {
    if (!source.has(value)) return false;
  }
  return true;
}

function selectMajorFacts(
  facts: AtomicFact[],
  mode: SummaryMode,
  limit: number,
): AtomicFact[] {
  let candidates = mode === "exam"
    ? facts.filter((fact) => EXAM_FACT_TYPES.has(fact.type))
    : facts.filter((fact) => fact.type !== "example");

  if (candidates.length === 0) candidates = facts;

  const ranked = [...candidates].sort(
    (left, right) =>
      right.importanceScore - left.importanceScore ||
      right.confidence - left.confidence,
  );
  const selected: AtomicFact[] = [];
  const selectedIds = new Set<string>();
  const representedSections = new Set<string>();

  for (const fact of ranked) {
    if (representedSections.has(fact.sourceSectionId)) continue;

    selected.push(fact);
    selectedIds.add(fact.id);
    representedSections.add(fact.sourceSectionId);

    if (selected.length >= limit) return selected;
  }

  for (const fact of ranked) {
    if (selectedIds.has(fact.id)) continue;
    selected.push(fact);
    if (selected.length >= limit) break;
  }

  return selected;
}

function selectRequiredSections(
  sections: SectionCoverage[],
  supportedFacts: AtomicFact[],
  mode: SummaryMode,
  limit: number,
): SectionCoverage[] {
  const factsById = new Map(
    supportedFacts.map((fact) => [fact.id, fact]),
  );
  const visible = sections.filter(
    (section) =>
      section.status === "covered" &&
      section.factIds.some((id) => factsById.has(id)),
  );

  if (!Number.isFinite(limit) || visible.length <= limit) {
    return visible;
  }

  const candidates = mode === "exam"
    ? visible.filter((section) =>
        section.factIds.some((id) => {
          const fact = factsById.get(id);
          return fact ? EXAM_FACT_TYPES.has(fact.type) : false;
        }),
      )
    : visible;
  const source = candidates.length > 0 ? candidates : visible;

  if (source.length <= limit) return source;
  if (limit <= 1) return source.slice(0, 1);

  const selectedIndexes = new Set<number>();
  for (let index = 0; index < limit; index += 1) {
    selectedIndexes.add(
      Math.round(
        (index * (source.length - 1)) / (limit - 1),
      ),
    );
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => source[index])
    .filter((item): item is SectionCoverage => Boolean(item));
}

function factIsRepresented(
  fact: AtomicFact,
  summary: string,
  factualUnits: string[],
): boolean {
  const factNumbers = extractNumericTokens(fact.content);
  const summaryNumbers = extractNumericTokens(summary);

  if (
    factNumbers.size > 0 &&
    !setIsSubset(factNumbers, summaryNumbers)
  ) {
    return false;
  }

  const normalisedFact = normalise(fact.content);
  if (
    normalisedFact &&
    normalise(summary).includes(normalisedFact)
  ) {
    return true;
  }

  return factualUnits.some(
    (unit) =>
      similarity(fact.content, unit) >=
      supportThreshold(fact.content),
  );
}

function sectionIsRepresented(
  section: SectionCoverage,
  summary: string,
  supportedFacts: AtomicFact[],
  factualUnits: string[],
): boolean {
  const heading = normalise(section.heading);
  if (heading && normalise(summary).includes(heading)) {
    return true;
  }

  const sectionFactIds = new Set(section.factIds);
  return supportedFacts.some(
    (fact) =>
      sectionFactIds.has(fact.id) &&
      factIsRepresented(fact, summary, factualUnits),
  );
}

function isGenericNonFact(value: string): boolean {
  const valueNormalised = normalise(value);
  return GENERIC_NON_FACT_PATTERNS.some((pattern) =>
    pattern.test(valueNormalised),
  );
}

function ratio(
  numerator: number,
  denominator: number,
  emptyValue: number,
): number {
  return denominator === 0
    ? emptyValue
    : numerator / denominator;
}

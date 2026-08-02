import type {
  ClaimType,
  ConceptCandidate,
  DocumentProfile,
  EvidenceSpan,
  ExtractedClaim,
  KnowledgeCore,
  NLPResult,
  NLPSentence,
  ValidationReport,
} from "../types";
import type { SectionedDocument } from "./types";

const PROBLEM_SIGNALS = [
  "problem", "challenge", "limitation", "lack of", "difficulty", "none have", "we address", "we tackle", "our goal", "aim",
];
const METHOD_SIGNALS = [
  "we use", "we propose", "we present", "we introduce", "approach", "method", "model", "framework", "technique",
];
const CONTRIBUTION_SIGNALS = [
  "we propose", "we present", "we introduce", "we develop", "we describe", "we show", "this paper describes", "contribution",
];
const LIMITATION_SIGNALS = [
  "limitation", "not possible", "could not", "restricted", "retrospective", "does not", "cannot", "future work",
];
const FUTURE_SIGNALS = ["future work", "in future", "future research", "we hope", "plan to", "could be extended"];
const SAMPLE_NOUNS = "projects?|participants?|subjects?|documents?|papers?|systems?|products?|repositories?|modules?|files?|cases?";
const RESULT_SECTION_ROLES = new Set(["abstract", "evaluation", "results", "discussion", "conclusion"]);

export function extractKnowledge(
  doc: SectionedDocument,
  nlp: NLPResult,
  profile: DocumentProfile,
): KnowledgeCore {
  const claims: ExtractedClaim[] = [];
  const addClaim = createClaimAdder(claims);

  extractProblemClaims(nlp.sentences, addClaim);
  extractMethodClaims(nlp.sentences, addClaim);
  extractToolClaims(nlp.sentences, addClaim);
  extractDataSourceClaims(nlp.sentences, addClaim);
  extractSampleClaims(nlp.sentences, addClaim);
  extractResultClaims(nlp.sentences, addClaim);
  extractSignalClaims(nlp.sentences, "contribution", CONTRIBUTION_SIGNALS, addClaim);
  extractSignalClaims(nlp.sentences, "limitation", LIMITATION_SIGNALS, addClaim);
  extractSignalClaims(nlp.sentences, "future_work", FUTURE_SIGNALS, addClaim);
  extractDefinitionClaims(nlp.sentences, addClaim);

  const concepts = extractConcepts(nlp);
  const emptyValidation: ValidationReport = {
    validClaimIds: [],
    rejectedClaimIds: [],
    validConceptIds: [],
    rejectedConceptIds: [],
    issues: [],
    groundedClaimRatio: 0,
    numericClaimRatio: 0,
    consistencyScore: 1,
    passed: false,
  };

  return {
    method: firstClaimObject(claims, "method"),
    dataset: firstClaimObject(claims, "data_source"),
    accuracy: extractLegacyAccuracy(claims),
    problem: firstClaimObject(claims, "problem"),
    contributions: claims.filter((claim) => claim.type === "contribution").map((claim) => claim.object),
    keyPoints: [],
    entities: concepts.filter((concept) => concept.valid).map((concept) => concept.term),
    extras: {
      metric: claims.find((claim) => claim.type === "result" && claim.metric)?.metric ?? null,
      limitations: firstClaimObject(claims, "limitation"),
      futureWork: firstClaimObject(claims, "future_work"),
      topic: nlp.keyPhrases[0] ?? nlp.keywords[0] ?? null,
      keywords: nlp.keyPhrases.slice(0, 20),
    },
    documentProfile: profile,
    claims,
    concepts,
    validation: emptyValidation,
    fieldStates: {},
  };
}

function extractProblemClaims(
  sentences: NLPSentence[],
  add: ClaimAdder,
): void {
  const scoped = sentences.filter((sentence) =>
    ["abstract", "background"].includes(sectionRole(sentence)) || /introduction/i.test(sentence.sectionTitle),
  );
  const candidate = scoped
    .filter((sentence) => containsSignal(sentence.text, PROBLEM_SIGNALS))
    .sort((a, b) => b.score - a.score)[0] ?? scoped[0];

  if (candidate) {
    add({
      type: "problem",
      sentence: candidate,
      subject: "Document",
      predicate: "addresses",
      object: candidate.text,
      confidence: containsSignal(candidate.text, PROBLEM_SIGNALS) ? 0.86 : 0.62,
    });
  }
}

function extractMethodClaims(sentences: NLPSentence[], add: ClaimAdder): void {
  for (const sentence of sentences) {
    const methods = sentence.entities.filter((entity) => ["METHOD", "ALGORITHM"].includes(entity.type));
    if (methods.length === 0) continue;
    const methodContext = containsSignal(sentence.text, METHOD_SIGNALS) || ["method", "implementation"].includes(sectionRole(sentence));

    for (const entity of methods.sort((a, b) => b.text.length - a.text.length).slice(0, 2)) {
      add({
        type: "method",
        sentence,
        subject: "Document",
        predicate: "uses",
        object: entity.text,
        confidence: methodContext ? 0.93 : 0.72,
      });
    }
  }
}

function extractToolClaims(sentences: NLPSentence[], add: ClaimAdder): void {
  for (const sentence of sentences) {
    for (const entity of sentence.entities.filter((item) => item.type === "TOOL")) {
      add({
        type: "tool",
        sentence,
        subject: "Document",
        predicate: /implemented|packaged|toolset|software/i.test(sentence.text) ? "implements with" : "mentions",
        object: entity.text,
        confidence: 0.88,
      });
    }
  }
}

function extractDataSourceClaims(sentences: NLPSentence[], add: ClaimAdder): void {
  for (const sentence of sentences) {
    const lower = sentence.text.toLowerCase();
    const hasDatasetLanguage = /\b(dataset|data set|corpus|benchmark)\b/.test(lower);
    for (const entity of sentence.entities.filter((item) => item.type === "DATASET")) {
      if (!hasDatasetLanguage && entity.text.length <= 4) continue;
      add({
        type: "data_source",
        sentence,
        subject: "Document",
        predicate: "uses data source",
        object: entity.text,
        confidence: hasDatasetLanguage ? 0.95 : 0.76,
      });
    }
  }
}

function extractSampleClaims(sentences: NLPSentence[], add: ClaimAdder): void {
  const samplePattern = new RegExp(
    `\\b(\\d{1,6})\\s+((?:[A-Za-z][A-Za-z-]*\\s+){0,4})(${SAMPLE_NOUNS})\\b`,
    "i",
  );
  for (const sentence of sentences) {
    const match = sentence.text.match(samplePattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const descriptor = `${match[2] ?? ""}${match[3]}`.replace(/\s+/g, " ").trim();

    add({
      type: "sample",
      sentence,
      subject: "Evaluation",
      predicate: /selected|identified|included|trial|used|assessed/i.test(sentence.text) ? "uses sample" : "mentions sample",
      object: `${match[1]} ${descriptor}`,
      numericValue: value,
      unit: match[3].toLowerCase(),
      qualifier: descriptor,
      confidence: 0.9,
    });
  }
}

function extractResultClaims(sentences: NLPSentence[], add: ClaimAdder): void {
  for (const sentence of sentences) {
    const text = sentence.text;
    const lower = text.toLowerCase();

    // Validation papers often report an error band and the percentage of
    // projects falling inside it. The result is the project percentage; the
    // inaccuracy range is a qualifier, not an accuracy value.
    const inaccuracyPattern = /(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?%\s+inaccuracy[^.;]*?\b(?:achieved\s+on|on)\s+(\d+(?:\.\d+)?)%\s+of\s+projects/gi;
    const inaccuracyMatches = [...text.matchAll(inaccuracyPattern)];
    for (const match of inaccuracyMatches) {
      const lowerBound = match[1];
      const upperBound = match[2];
      const projectPercent = Number.parseFloat(match[3]);
      if (!Number.isFinite(projectPercent)) continue;
      add({
        type: "result",
        sentence,
        subject: "Prediction validation",
        predicate: "reports project proportion",
        object: `${projectPercent}% of projects had ${upperBound ? `${lowerBound}-${upperBound}%` : `${lowerBound}%`} prediction inaccuracy`,
        numericValue: projectPercent,
        unit: "percent of projects",
        metric: "prediction inaccuracy",
        qualifier: upperBound ? `${lowerBound}-${upperBound}% inaccuracy` : `${lowerBound}% inaccuracy`,
        confidence: 0.97,
      });
    }
    if (inaccuracyMatches.length > 0) continue;

    const numbers = sentence.entities
      .filter((entity) => entity.type === "NUMBER")
      .filter((entity) => !isStructuralNumber(entity.text, lower));
    const metrics = sentence.entities.filter((entity) => entity.type === "METRIC");
    const role = sectionRole(sentence);
    const resultLanguage = /\b(result|found|achieved|confirm|correlation|accuracy|inaccuracy|improvement|performed|compared|outperform|good fit)\b/i.test(text);

    if (numbers.length === 0 || (!RESULT_SECTION_ROLES.has(role) && !resultLanguage)) continue;

    const metric = chooseMetric(text, metrics.map((entity) => entity.text));
    const hasPercentage = numbers.some((entity) => entity.text.includes("%"));
    const samplePattern = new RegExp(`\\b\\d{1,6}\\s+(?:${SAMPLE_NOUNS})\\b`, "i");

    // A sample size belongs to a sample claim, not a result claim, unless the
    // sentence also contains a genuine metric/percentage result.
    if (samplePattern.test(text) && !metric && !hasPercentage) continue;
    if (!metric && !hasPercentage && role !== "results") continue;

    const numericValue = chooseMetricValue(text, metric, numbers.map((entity) => entity.text));
    if (numericValue === null) continue;

    add({
      type: "result",
      sentence,
      subject: "Study",
      predicate: "reports",
      object: text,
      numericValue,
      unit: text.includes(`${numericValue}%`) || text.includes(`${numericValue.toFixed(1)}%`) ? "percent" : undefined,
      metric,
      confidence: metric ? 0.93 : 0.72,
    });

    if (metric) {
      add({
        type: "metric",
        sentence,
        subject: "Evaluation",
        predicate: "uses metric",
        object: metric,
        metric,
        confidence: 0.9,
      });
    }
  }
}

function isStructuralNumber(numberText: string, sentenceLower: string): boolean {
  const escaped = numberText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:section|figure|table|equation|reference)\\s+${escaped.replace('%', '')}\\b`, "i").test(sentenceLower);
}

function chooseMetricValue(text: string, metric: string | undefined, rawNumbers: string[]): number | null {
  const candidates = rawNumbers
    .map((raw) => ({ raw, value: Number.parseFloat(raw.replace("%", "")) }))
    .filter((item) => Number.isFinite(item.value));
  if (candidates.length === 0) return null;

  if (metric) {
    const lower = text.toLowerCase();
    const metricIndex = lower.indexOf(metric.toLowerCase());
    if (metricIndex >= 0) {
      const positioned = candidates.map((candidate) => ({
        ...candidate,
        index: lower.indexOf(candidate.raw.toLowerCase()),
      }));
      positioned.sort((a, b) => Math.abs(a.index - metricIndex) - Math.abs(b.index - metricIndex));
      return positioned[0].value;
    }
  }

  const percent = candidates.find((candidate) => candidate.raw.includes("%"));
  return percent?.value ?? candidates[0].value;
}

function extractSignalClaims(
  sentences: NLPSentence[],
  type: Extract<ClaimType, "contribution" | "limitation" | "future_work">,
  signals: string[],
  add: ClaimAdder,
): void {
  for (const sentence of sentences) {
    if (!containsSignal(sentence.text, signals)) continue;
    add({
      type,
      sentence,
      subject: "Document",
      predicate: type === "contribution" ? "contributes" : type === "limitation" ? "is limited by" : "proposes",
      object: sentence.text,
      confidence: 0.82,
    });
  }
}

function extractDefinitionClaims(sentences: NLPSentence[], add: ClaimAdder): void {
  const pattern = /^(.{2,80}?)\s+(?:is|are|refers to|means)\s+(.{20,260})$/i;
  for (const sentence of sentences) {
    const match = sentence.text.match(pattern);
    if (!match || sentence.text.length > 360) continue;
    if (!sentence.entities.some((entity) => ["CONCEPT", "METHOD", "ACRONYM"].includes(entity.type))) continue;
    add({
      type: "definition",
      sentence,
      subject: match[1].trim(),
      predicate: "is defined as",
      object: match[2].trim(),
      confidence: 0.74,
    });
  }
}

function extractConcepts(nlp: NLPResult): ConceptCandidate[] {
  const terms = new Map<string, { term: string; occurrences: number; evidence: EvidenceSpan[] }>();

  const add = (term: string, sentence: NLPSentence, weight = 1) => {
    const normalized = normalizeTerm(term);
    if (!normalized) return;
    const current = terms.get(normalized) ?? { term, occurrences: 0, evidence: [] };
    current.occurrences += weight;
    if (!current.evidence.some((evidence) => evidence.text === sentence.text)) {
      current.evidence.push(toEvidence(sentence));
    }
    if (term.length > current.term.length) current.term = term;
    terms.set(normalized, current);
  };

  for (const sentence of nlp.sentences) {
    for (const entity of sentence.entities) {
      if (["METHOD", "ALGORITHM", "TOOL", "CONCEPT"].includes(entity.type)) add(entity.text, sentence, 3);
    }
    for (const phrase of nlp.keyPhrases) {
      if (sentence.text.toLowerCase().includes(phrase.toLowerCase())) add(phrase, sentence, 1);
    }
  }

  return [...terms.entries()]
    .map(([normalizedTerm, item], index) => {
      const invalid = invalidConceptReason(item.term);
      return {
        id: `concept-${slugify(normalizedTerm)}-${index + 1}`,
        term: titleCasePreservingAcronyms(item.term),
        normalizedTerm,
        occurrences: item.occurrences,
        sectionIds: [...new Set(item.evidence.map((evidence) => evidence.sectionId))],
        evidence: item.evidence.slice(0, 4),
        score: Math.min(1, 0.35 + item.occurrences * 0.08 + Math.min(0.25, item.evidence.length * 0.05)),
        valid: invalid === null,
        ...(invalid ? { rejectionReason: invalid } : {}),
      } satisfies ConceptCandidate;
    })
    .sort((a, b) => Number(b.valid) - Number(a.valid) || b.score - a.score || b.term.length - a.term.length)
    .slice(0, 40);
}

interface AddClaimInput {
  type: ClaimType;
  sentence: NLPSentence;
  subject: string;
  predicate: string;
  object: string;
  metric?: string;
  numericValue?: number;
  unit?: string;
  qualifier?: string;
  confidence: number;
}

type ClaimAdder = (input: AddClaimInput) => void;

function createClaimAdder(claims: ExtractedClaim[]): ClaimAdder {
  const seen = new Set<string>();
  return (input) => {
    const key = `${input.type}:${input.object.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    claims.push({
      id: `claim-${input.type}-${claims.length + 1}`,
      type: input.type,
      subject: input.subject,
      predicate: input.predicate,
      object: input.object.trim(),
      metric: input.metric,
      numericValue: input.numericValue,
      unit: input.unit,
      qualifier: input.qualifier,
      evidence: [toEvidence(input.sentence)],
      extractionSource: "symbolic",
      confidence: input.confidence,
      validationStatus: "pending",
      validationMessages: [],
    });
  };
}

function toEvidence(sentence: NLPSentence): EvidenceSpan {
  return {
    id: `evidence-${sentence.id}`,
    sectionId: sentence.sectionId,
    sectionTitle: sentence.sectionTitle,
    pageNumber: sentence.pageNumber,
    text: sentence.text,
  };
}

function sectionRole(sentence: NLPSentence): string {
  const heading = sentence.sectionTitle.toLowerCase();
  if (/abstract/.test(heading)) return "abstract";
  if (/method|model|approach|modelling/.test(heading)) return "method";
  if (/implementation|toolset|application/.test(heading)) return "implementation";
  if (/experiment|evaluation|validation|trial/.test(heading)) return "evaluation";
  if (/result|finding/.test(heading)) return "results";
  if (/discussion|limitation/.test(heading)) return "discussion";
  if (/conclusion|future/.test(heading)) return "conclusion";
  return "background";
}

function chooseMetric(text: string, detected: string[]): string | undefined {
  const lower = text.toLowerCase();
  const ordered = [
    "linear correlation coefficient", "correlation coefficient", "prediction inaccuracy", "inaccuracy", "accuracy",
    "precision", "recall", "f1 score", "f1", "auc", "roc", "rmse", "mae", "mse", "perplexity",
  ];
  return ordered.find((metric) => lower.includes(metric)) ?? detected.sort((a, b) => b.length - a.length)[0]?.toLowerCase();
}

function containsSignal(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some((signal) => lower.includes(signal));
}

function firstClaimObject(claims: ExtractedClaim[], type: ClaimType): string | null {
  return claims.find((claim) => claim.type === type)?.object ?? null;
}

function extractLegacyAccuracy(claims: ExtractedClaim[]): number | null {
  const claim = claims.find((item) => item.type === "result" && item.metric?.toLowerCase() === "accuracy");
  return claim?.numericValue ?? null;
}

function normalizeTerm(term: string): string | null {
  const normalized = term.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  return invalidConceptReason(normalized) ? null : normalized;
}

function invalidConceptReason(term: string): string | null {
  const value = term.trim();
  if (value.length < 3) return "Concept is too short.";
  if (/^\d+(?:\.\d+)?%?$/.test(value)) return "Standalone numbers are not concepts.";
  if (/^\[?\d+(?:\s*[,–-]\s*\d+)*\]?$/.test(value)) return "Citation references are not concepts.";
  if (/^(section|figure|page)\s+\d+/i.test(value)) return "Structural labels are not concepts.";
  if (value.split(/\s+/).length === 1 && value.toLowerCase() === "map") return "Ambiguous generic token.";
  return null;
}

function titleCasePreservingAcronyms(term: string): string {
  return term
    .split(/\s+/)
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

import type { NLPResult } from "../types";
import type {
  DocumentClassification,
  KeyTermDefinition,
  StudyConcept,
} from "./types";
import { normaliseLine } from "./text-quality";

const INVALID_CONCEPTS = new Set([
  "future",
  "per year",
  "best case",
  "worst case",
  "new brewpub",
  "this",
  "that",
  "these",
  "those",
  "she",
  "he",
  "they",
  "it",
  "suppose they",
  "these costs",
  "case study",
  "introduction",
  "conclusion",
  "results",
  "methodology",
  "lecture note",
  "student presentation template",
  "key points",
  "main concepts",
  "key takeaways",
]);

const DOMAIN_CONCEPTS: Record<string, string[]> = {
  finance: [
    "capital budgeting",
    "relevant cash flow",
    "sunk cost",
    "operating cash flow",
    "capital expenditure",
    "net working capital",
    "depreciation tax shield",
    "net present value",
    "internal rate of return",
    "scenario analysis",
    "sensitivity analysis",
    "terminal cash flow",
    "salvage value",
    "cost of capital",
    "discount rate",
    "tax rate",
    "incremental cash flow",
    "working capital recovery",
  ],
  software_engineering: [
    "software defect prediction",
    "class imbalance",
    "noisy instances",
    "software metrics",
    "fault proneness",
    "software testing",
    "baseline model",
    "true positive rate",
    "false positive rate",
    "receiver operating characteristic",
  ],
  data_science: [
    "machine learning",
    "classification",
    "regression",
    "feature selection",
    "training data",
    "test data",
    "model evaluation",
  ],
  computer_science: [
    "algorithm",
    "database",
    "network protocol",
    "computer vision",
    "natural language processing",
    "cybersecurity",
  ],
};

const ALIASES = new Map<string, string>([
  ["npv", "Net Present Value (NPV)"],
  ["net present value", "Net Present Value (NPV)"],
  ["irr", "Internal Rate of Return (IRR)"],
  ["internal rate of return", "Internal Rate of Return (IRR)"],
  ["best case scenario", "Best-Case Scenario"],
  ["worst case scenario", "Worst-Case Scenario"],
  ["working capital", "Net Working Capital"],
  ["net working capital", "Net Working Capital"],
  ["roc", "Receiver Operating Characteristic (ROC)"],
]);

function normalizeConcept(value: string): string {
  return normaliseLine(value)
    .replace(/^[-–—•*\d.)\s]+/, "")
    .replace(/[.:;,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalConcept(value: string): string {
  const cleaned = normalizeConcept(value);
  const alias = ALIASES.get(cleaned.toLowerCase());
  if (alias) return alias;

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^(ai|ml|nlp|sql|api|tpr|fpr|ooad|srs|uml)$/i.test(word)) return word.toUpperCase();
      if (/^(and|of|in|for|to|with)$/i.test(word)) return word.toLowerCase();
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export function hasWeakReference(text: string): boolean {
  return /^(she|he|they|this|that|these|those|it|such|suppose)\b/i.test(
    text.trim(),
  );
}

export function isValidConcept(term: string): boolean {
  const normalized = normalizeConcept(term).toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);

  return (
    normalized.length >= 4 &&
    normalized.length <= 85 &&
    words.length <= 7 &&
    !INVALID_CONCEPTS.has(normalized) &&
    !hasWeakReference(normalized) &&
    !/^\d+(?:\.\d+)?%?$/.test(normalized) &&
    !/[.!?]/.test(normalized) &&
    !/^(year|page|table|figure)\s+\d+$/i.test(normalized) &&
    !/^slide\s+\d+/i.test(normalized) &&
    !/\b(?:insert|placeholder)\b/i.test(normalized) &&
    !/\bdiagram\s+insert\s+diagram\b/i.test(normalized) &&
    /[a-z]/i.test(normalized)
  );
}

function phraseFrequency(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length ?? 0;
}

function evidenceSentence(text: string, phrase: string): string | undefined {
  const lowerPhrase = phrase.toLowerCase();
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normaliseLine)
    .find((sentence) => sentence.toLowerCase().includes(lowerPhrase));
}

function categoryFor(term: string, classification: DocumentClassification): string {
  const lower = term.toLowerCase();
  if (/npv|irr|cash flow|capital|working capital|salvage|discount|tax|depreciation/.test(lower)) {
    return "finance";
  }
  if (/scenario|sensitivity/.test(lower)) return "analysis";
  if (/dataset|model|algorithm|prediction|classification|roc|rate/.test(lower)) {
    return classification.domain;
  }
  return "concept";
}

export function extractValidatedConcepts(
  text: string,
  nlp: NLPResult,
  classification: DocumentClassification,
  limit = 18,
): StudyConcept[] {
  const candidates: Array<{
    term: string;
    confidence: number;
    evidence?: string;
    source: "domain" | "entity" | "keyword";
  }> = [];

  for (const phrase of DOMAIN_CONCEPTS[classification.domain] ?? []) {
    const count = phraseFrequency(text, phrase);
    if (count > 0) {
      candidates.push({
        term: phrase,
        confidence: Math.min(0.99, 0.78 + Math.min(count, 4) * 0.05),
        evidence: evidenceSentence(text, phrase),
        source: "domain",
      });
    }
  }

  for (const entity of nlp.entities) {
    candidates.push({
      term: entity.text,
      confidence: entity.type === "NUMBER" ? 0.2 : 0.72,
      evidence: evidenceSentence(text, entity.text),
      source: "entity",
    });
  }

  for (const keyword of nlp.keywords) {
    candidates.push({
      term: keyword,
      confidence: 0.58,
      evidence: evidenceSentence(text, keyword),
      source: "keyword",
    });
  }

  const output: StudyConcept[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates.sort((a, b) => b.confidence - a.confidence)) {
    if (!isValidConcept(candidate.term)) continue;
    if (
      candidate.source !== "domain" &&
      candidate.evidence &&
      /(?:@|orcid|university|institute|received:|accepted:|communicated by|telephone|tel\.?)/i.test(candidate.evidence)
    ) {
      continue;
    }

    const rawWords = normalizeConcept(candidate.term).split(/\s+/).filter(Boolean);
    if (candidate.source === "keyword" && rawWords.length === 1) continue;

    const term = canonicalConcept(candidate.term);
    const normalized = term
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    output.push({
      term,
      normalized,
      category: categoryFor(term, classification),
      confidence: candidate.confidence,
      evidence: candidate.evidence,
    });

    if (output.length >= limit) break;
  }

  return output;
}

function cleanDefinition(value: string): string {
  return normaliseLine(value)
    .replace(/^[-–—:;,\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractValidatedKeyTerms(
  text: string,
  concepts: StudyConcept[],
  limit = 12,
): KeyTermDefinition[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normaliseLine)
    .filter((sentence) => sentence.length >= 25 && sentence.length <= 420);

  const definitions: KeyTermDefinition[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const match = sentence.match(
      /^([A-Z][A-Za-z0-9 ()/_&-]{2,70}?)\s*(?::|—|-|\bis\b|\bare\b|\bmeans\b|\brefers to\b)\s+(.{18,320})$/i,
    );

    if (!match) continue;

    const rawTerm = normalizeConcept(match[1]);
    const definition = cleanDefinition(match[2]);

    if (!isValidConcept(rawTerm) || hasWeakReference(definition)) continue;
    if (definition.split(/\s+/).length < 4) continue;

    const term = canonicalConcept(rawTerm);
    const key = term.toLowerCase();
    if (seen.has(key)) continue;

    const conceptMatch = concepts.some((concept) =>
      concept.normalized.includes(rawTerm.toLowerCase()) ||
      rawTerm.toLowerCase().includes(concept.normalized),
    );

    seen.add(key);
    definitions.push({
      term,
      definition,
      confidence: conceptMatch ? 0.9 : 0.74,
      evidence: sentence,
    });

    if (definitions.length >= limit) break;
  }

  return definitions;
}

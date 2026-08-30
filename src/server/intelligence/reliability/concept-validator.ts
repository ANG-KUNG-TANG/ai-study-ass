import type { NLPResult } from "../types";
import type {
  DocumentClassification,
  KeyTermDefinition,
  StudyConcept,
} from "./types";
import { normaliseLine } from "./text-quality";
import {
  canonicalStudyConceptKey,
  isStudyNoiseLine,
  looksLikePersonName,
} from "../pipeline/source-hygiene";

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
  "there",
  "name",
  "address",
  "what",
  "when",
  "where",
  "why",
  "how",
  "step 1",
  "step 2",
  "step 3",
  "step 4",
  "stage 1",
  "stage 2",
  "test 1",
  "test 2",
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

const EXAMPLE_ONLY_EVIDENCE_RE =
  /(?:^(?:for example|for instance)\b|\b(?:used (?:here )?only as an example|is (?:used )?(?:here )?only as an example|is (?:only )?an example of|serves? as an example|example only)\b)/iu;

const KNOWN_TECHNICAL_ACRONYMS = new Set([
  "ai", "api", "cpu", "css", "csv", "dbms", "dhcp", "dns", "ftp",
  "gpu", "html", "http", "https", "ip", "irr", "json", "lan", "ml",
  "nlp", "npv", "ooad", "ooa", "ood", "os", "pdf", "ram", "rdbms",
  "roc", "rom", "sql", "srs", "ssh", "ssl", "stp", "tcp", "tls",
  "udp", "ui", "uml", "url", "ux", "vlan", "vpn", "wan", "xml",
]);

const ALIASES = new Map<string, string>([
  ["ooad", "Object-Oriented Analysis and Design (OOAD)"],
  ["ooa", "Object-Oriented Analysis (OOA)"],
  ["objectoriented analysis", "Object-Oriented Analysis (OOA)"],
  ["object oriented analysis", "Object-Oriented Analysis (OOA)"],
  ["object-oriented analysis", "Object-Oriented Analysis (OOA)"],
  ["ood", "Object-Oriented Design (OOD)"],
  ["objectoriented design", "Object-Oriented Design (OOD)"],
  ["object oriented design", "Object-Oriented Design (OOD)"],
  ["object-oriented design", "Object-Oriented Design (OOD)"],
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
  const normalizedAliasKey = cleaned
    .toLowerCase()
    .replace(/\s*\((?:ooa|ood|npv|irr|roc)\)\s*$/i, "");
  const alias = ALIASES.get(cleaned.toLowerCase()) ??
    ALIASES.get(normalizedAliasKey);
  if (alias) return alias;

  // Outside explicit aliases, preserve the source's meaningful casing.
  // This avoids damaging product/technology names such as MongoDB and
  // avoids changing natural labels such as "Redis queue" into title case.
  return cleaned
    .split(/\s+/)
    .map((word) =>
      KNOWN_TECHNICAL_ACRONYMS.has(word.toLowerCase()) || /^(tpr|fpr)$/i.test(word)
        ? word.toUpperCase()
        : word,
    )
    .join(" ");
}

export function canonicalizeStudyConceptLabel(value: string): string {
  return canonicalConcept(value);
}

export function isExampleOnlyConceptEvidence(value: string): boolean {
  return EXAMPLE_ONLY_EVIDENCE_RE.test(
    value.normalize("NFKC").replace(/\s+/gu, " ").trim(),
  );
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
    (normalized.length >= 4 || KNOWN_TECHNICAL_ACRONYMS.has(normalized)) &&
    normalized.length <= 85 &&
    words.length <= 7 &&
    !INVALID_CONCEPTS.has(normalized) &&
    !hasWeakReference(normalized) &&
    !isStudyNoiseLine(normalized) &&
    !/^(?:figure\s+shows?|following\s+figure|example)$/i.test(normalized) &&
    !/^in\s+(?:oop|object[- ]oriented\s+programming)\b/i.test(normalized) &&
    !/\b(?:for example|for instance|example of|example only)\b/i.test(normalized) &&
    !/[,;]/.test(normalized) &&
    !/^\d+(?:\.\d+)?%?$/.test(normalized) &&
    !/[.!?]/.test(normalized) &&
    !/^(year|page|table|figure)\s+\d+$/i.test(normalized) &&
    !/^slide\s+\d+/i.test(normalized) &&
    !/^(?:step|stage|test|phase|part)\s*\d+(?:\b|\s*[:\-])/i.test(normalized) &&
    !/^(?:there|name|address|value|item|details?|information|data|content|notes?|what|when|where|why|how)$/i.test(normalized) &&
    !/^["“”'‘’]/u.test(normalized) &&
    !/^the\s+.+\b(?:is|are|uses?|translates?|converts?|connects?|sends?|receives?|shows?|explains?|provides?)\b/i.test(normalized) &&
    !(words.length >= 3 && /\b(?:is|are|was|were|has|have|does|do|uses?|translates?|converts?|connects?|sends?|receives?|shows?|explains?|provides?|contains?|includes?|requires?|allows?|ensures?|prevents?|represents?|displays?)\b/i.test(normalized)) &&
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
      (
        /(?:@|orcid|university|institute|received:|accepted:|communicated by|telephone|tel\.?)/i.test(candidate.evidence) ||
        (
          isExampleOnlyConceptEvidence(candidate.evidence) &&
          phraseFrequency(text, candidate.term) <= 2
        )
      )
    ) {
      continue;
    }

    const rawWords = normalizeConcept(candidate.term).split(/\s+/).filter(Boolean);
    if (candidate.source === "keyword" && rawWords.length === 1) continue;

    const term =
      canonicalConcept(
        candidate.term,
      );
    const normalized =
      canonicalStudyConceptKey(
        term,
      );

    if (
      candidate.source !==
        "domain" &&
      looksLikePersonName(term) &&
      phraseFrequency(
        text,
        term,
      ) < 2
    ) {
      continue;
    }

    if (
      !normalized ||
      seen.has(normalized)
    ) {
      continue;
    }

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

    if (
      !isValidConcept(rawTerm) ||
      hasWeakReference(definition) ||
      isExampleOnlyConceptEvidence(definition) ||
      isExampleOnlyConceptEvidence(sentence)
    ) {
      continue;
    }
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

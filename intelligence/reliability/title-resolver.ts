import type { RawDocument, SectionedDocument } from "../pipeline/types";
import type { DocumentClassification, ResolvedTitle, TitleSource } from "./types";
import {
  corruptedCharacterRatio,
  greekCharacterRatio,
  normaliseLine,
} from "./text-quality";

const SECTION_HEADINGS = new Set([
  "abstract",
  "introduction",
  "background",
  "methodology",
  "methods",
  "results",
  "discussion",
  "conclusion",
  "references",
  "bibliography",
  "case study",
  "overview",
]);

const GENERIC_TITLE_WORDS = new Set([
  "case",
  "study",
  "series",
  "document",
  "paper",
  "report",
  "chapter",
  "notes",
  "untitled",
]);

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^(NPV|IRR|AI|ML|NLP|SQL|API)$/i.test(word)) return word.toUpperCase();
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export function collapseRepeatedPhrases(title: string): string {
  let words = normaliseLine(title).split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.join(" ");

  let changed = true;
  while (changed) {
    changed = false;

    for (let size = Math.floor(words.length / 2); size >= 1; size -= 1) {
      for (let start = 0; start + size * 2 <= words.length; start += 1) {
        const first = words.slice(start, start + size).join(" ").toLowerCase();
        const second = words.slice(start + size, start + size * 2).join(" ").toLowerCase();
        if (first !== second) continue;

        words = [
          ...words.slice(0, start + size),
          ...words.slice(start + size * 2),
        ];
        changed = true;
        break;
      }
      if (changed) break;
    }
  }

  return words.join(" ");
}

function filenameTitle(fileName: string): string {
  return titleCase(
    fileName
      .replace(/\.(pdf|docx|txt)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function repeatedNgramRatio(value: string): number {
  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 4) return 0;

  const grams = words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`);
  const unique = new Set(grams);
  return grams.length === 0 ? 0 : 1 - unique.size / grams.length;
}

function rejectReason(value: string): string | null {
  const cleaned = collapseRepeatedPhrases(value)
    .replace(/^[\d.\-–—\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 8) return "too short";
  if (cleaned.length > 150) return "too long";
  if (corruptedCharacterRatio(cleaned) > 0.05) return "contains corrupted symbols";
  if (greekCharacterRatio(cleaned) > 0.18) return "contains likely encoding noise";
  if (repeatedNgramRatio(cleaned) > 0.32) return "contains repeated phrases";

  const lower = cleaned.toLowerCase();
  if (SECTION_HEADINGS.has(lower)) return "is a section heading";

  const meaningfulWords = lower
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !GENERIC_TITLE_WORDS.has(word));
  if (meaningfulWords.length < 2) return "is too generic";

  if (/^(case study series|research article|noname manuscript)/i.test(cleaned)) {
    return "is a publication header";
  }

  return null;
}

function firstHeadingCandidates(doc: SectionedDocument): string[] {
  const fragments: string[] = [];

  for (const section of doc.sections.slice(0, 8)) {
    if (section.title !== "other") break;

    if (section.rawHeading) fragments.push(normaliseLine(section.rawHeading));
    fragments.push(
      ...section.body
        .split("\n")
        .map(normaliseLine)
        .filter((line) => line.length >= 3 && line.length <= 150)
        .slice(0, 4),
    );
  }

  const compact = fragments
    .filter(Boolean)
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, 10);
  const candidates: string[] = [];

  // PDF title wrapping is frequently misclassified as several adjacent
  // "other" headings. Recombine the first fragments before considering them
  // separately.
  for (const size of [3, 2]) {
    for (let index = 0; index + size <= Math.min(compact.length, 6); index += 1) {
      const joined = compact.slice(index, index + size).join(" ");
      if (joined.length >= 12 && joined.length <= 150) candidates.push(joined);
    }
  }

  candidates.push(...compact.filter((line) => line.length >= 8));
  return candidates;
}

function findCaseEntity(text: string): string | null {
  const organization = text.match(
    /([A-Z][A-Za-z&'’.-]+(?:\s+[A-Z][A-Za-z&'’.-]+){0,3}\s+(?:Caf[eé]|Cafe|Restaurant|Company|Corporation|Ltd\.?|Inc\.?))(?=\s|[,.!?]|$)/,
  );
  if (organization?.[1]) return organization[1].trim();

  const owners = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+and\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
  if (owners?.[1] && owners?.[2]) return `${owners[1]} and ${owners[2]}`;

  return null;
}

function generatedTitle(text: string, classification: DocumentClassification): string {
  const lower = text.toLowerCase();

  if (classification.kind === "case_study" && classification.domain === "finance") {
    const entity = findCaseEntity(text);
    const project = /brewpub/.test(lower)
      ? "Brewpub Investment"
      : /restaurant/.test(lower)
        ? "Restaurant Investment"
        : "Capital Budgeting Investment";

    return `${entity ? `${entity} ` : ""}${project} Case Study`.trim();
  }

  if (classification.taskType === "software_defect_prediction_analysis") {
    const topics = [
      /class imbalance/.test(lower) ? "Class Imbalance" : "",
      /noise|noisy/.test(lower) ? "Noise" : "",
      "Software Defect Prediction",
    ].filter(Boolean);
    return topics.join(" and ").replace(" and Software", " in Software");
  }

  if (classification.kind === "research_paper") {
    const firstSentence = text
      .split(/(?<=[.!?])\s+/)
      .map(normaliseLine)
      .find((sentence) => sentence.length >= 35 && sentence.length <= 180);
    if (firstSentence) {
      return titleCase(firstSentence.split(/[,;:.]/)[0].slice(0, 110));
    }
  }

  const domain = classification.domain.replace(/_/g, " ");
  const kind = classification.kind.replace(/_/g, " ");
  return titleCase(`${domain} ${kind}`);
}

export function resolveDocumentTitle(
  raw: RawDocument,
  doc: SectionedDocument,
  classification: DocumentClassification,
): ResolvedTitle {
  const rejectedCandidates: ResolvedTitle["rejectedCandidates"] = [];
  const metadataTitle = (raw as RawDocument & { metadataTitle?: string }).metadataTitle;

  const candidates: Array<{ value: string; source: TitleSource; confidence: number }> = [
    ...(metadataTitle
      ? [{ value: metadataTitle, source: "metadata" as const, confidence: 0.98 }]
      : []),
    ...firstHeadingCandidates(doc).map((value, index) => ({
      value,
      source: "heading" as const,
      confidence: Math.max(0.72, 0.94 - index * 0.04),
    })),
    {
      value: filenameTitle(raw.fileName),
      source: "filename",
      confidence: 0.62,
    },
  ];

  for (const candidate of candidates) {
    const collapsed = collapseRepeatedPhrases(candidate.value);
    const reason = rejectReason(collapsed);

    if (!reason) {
      return {
        value: collapsed,
        source: candidate.source,
        confidence: candidate.confidence,
        generated: false,
        rejectedCandidates,
      };
    }

    rejectedCandidates.push({ value: candidate.value, reason });
  }

  const generated = collapseRepeatedPhrases(generatedTitle(doc.cleanText, classification));
  const generatedReason = rejectReason(generated);

  if (!generatedReason) {
    return {
      value: generated,
      source: "generated",
      confidence: classification.confidence >= 0.7 ? 0.84 : 0.72,
      generated: true,
      rejectedCandidates,
    };
  }

  rejectedCandidates.push({ value: generated, reason: generatedReason });

  return {
    value: "Generated Study Notes",
    source: "generated",
    confidence: 0.45,
    generated: true,
    rejectedCandidates,
  };
}

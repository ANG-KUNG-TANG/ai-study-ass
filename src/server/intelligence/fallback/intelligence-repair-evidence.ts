import type { DocumentChunk } from "../pipeline";
import type { ExpectedField } from "../types";

const DEFAULT_MAX_CHARACTERS = 7_000;
const DEFAULT_MAX_CHUNKS = 6;

const FIELD_HINTS: Record<ExpectedField, readonly string[]> = {
  problem: ["problem", "challenge", "issue", "motivation", "pain point", "need"],
  objective: ["objective", "goal", "aim", "purpose", "research question", "intended to"],
  method: ["method", "methodology", "approach", "procedure", "design", "algorithm", "technique"],
  tool: ["tool", "software", "framework", "library", "platform", "technology", "implemented using"],
  data_source: ["dataset", "data source", "data collected", "records", "corpus", "database", "repository"],
  sample: ["sample", "participants", "projects", "subjects", "instances", "cases", "respondents"],
  metric: ["metric", "measure", "precision", "recall", "f1", "accuracy", "auc", "rmse", "mae", "correlation"],
  result: ["result", "finding", "performance", "achieved", "improved", "evaluation", "outcome"],
  contribution: ["contribution", "novel", "propose", "proposed", "introduce", "introduced", "we present"],
  limitation: ["limitation", "limitations", "threat", "constraint", "weakness", "drawback"],
  future_work: ["future work", "future research", "further work", "next step", "future study"],
  definition: ["definition", "defined as", "refers to", "means", "is a", "are a"],
};

const FIELD_ROLES: Record<
  ExpectedField,
  readonly DocumentChunk["semanticRole"][]
> = {
  problem: ["abstract", "background", "discussion", "other"],
  objective: ["abstract", "background", "other"],
  method: ["method", "implementation"],
  tool: ["method", "implementation"],
  data_source: ["method", "implementation", "evaluation"],
  sample: ["method", "evaluation"],
  metric: ["evaluation", "results"],
  result: ["evaluation", "results", "discussion", "conclusion"],
  contribution: ["abstract", "discussion", "conclusion"],
  limitation: ["discussion", "conclusion"],
  future_work: ["discussion", "conclusion"],
  definition: ["background", "abstract", "other"],
};

export interface IntelligenceRepairEvidenceOptions {
  maxCharacters?: number;
  maxChunks?: number;
}

export interface IntelligenceRepairEvidence {
  text: string;
  fields: ExpectedField[];
  chunkIds: string[];
  sectionIds: string[];
  characterCount: number;
  wasTruncated: boolean;
}

/**
 * Builds a small evidence window for the exact structured fields that are
 * missing from deterministic intelligence.
 *
 * This intentionally works from source chunks rather than GroundedKnowledge:
 * a missing structured claim can still exist in source text when deterministic
 * claim extraction failed to promote it into GroundedKnowledge.
 */
export function buildIntelligenceRepairEvidence(
  chunks: readonly DocumentChunk[],
  missingFields: readonly ExpectedField[],
  options: IntelligenceRepairEvidenceOptions = {},
): IntelligenceRepairEvidence {
  const fields = [...new Set(missingFields)];
  const maxCharacters = clamp(
    options.maxCharacters ?? DEFAULT_MAX_CHARACTERS,
    1_200,
    10_000,
  );
  const maxChunks = clamp(
    options.maxChunks ?? DEFAULT_MAX_CHUNKS,
    1,
    10,
  );
  const candidates = chunks.filter((chunk) => chunk.text.trim().length > 0);

  if (fields.length === 0 || candidates.length === 0) {
    return {
      text: "",
      fields,
      chunkIds: [],
      sectionIds: [],
      characterCount: 0,
      wasTruncated: false,
    };
  }

  const selected: DocumentChunk[] = [];
  const selectedIds = new Set<string>();

  const addChunk = (chunk: DocumentChunk | undefined): void => {
    if (!chunk || selectedIds.has(chunk.id) || selected.length >= maxChunks) {
      return;
    }
    selectedIds.add(chunk.id);
    selected.push(chunk);
  };

  for (const field of fields) {
    const best = [...candidates].sort(
      (left, right) =>
        scoreChunkForField(right, field) - scoreChunkForField(left, field) ||
        left.tokenEstimate - right.tokenEstimate,
    )[0];
    addChunk(best);
  }

  const overall = [...candidates].sort(
    (left, right) =>
      scoreChunkAcrossFields(right, fields) -
        scoreChunkAcrossFields(left, fields) ||
      left.tokenEstimate - right.tokenEstimate,
  );

  for (const candidate of overall) {
    addChunk(candidate);
    if (selected.length >= maxChunks) break;
  }

  const headingAllowance = selected.reduce(
    (sum, chunk) => sum + chunk.sectionTitle.length + 40,
    0,
  );
  const perChunkBudget = Math.max(
    420,
    Math.floor(
      (maxCharacters - Math.min(headingAllowance, maxCharacters / 3)) /
        Math.max(1, selected.length),
    ),
  );

  const blocks = selected.map((chunk) => {
    const excerpt = buildRelevantExcerpt(chunk.text, fields, perChunkBudget);
    const pageLabel = chunk.pageStart
      ? ` | page ${chunk.pageStart}${
          chunk.pageEnd && chunk.pageEnd !== chunk.pageStart
            ? `-${chunk.pageEnd}`
            : ""
        }`
      : "";

    return `[${cleanHeading(chunk.sectionTitle)}${pageLabel}]\n${excerpt}`;
  });

  const joined = blocks.join("\n\n").trim();
  const text = truncateAtBoundary(joined, maxCharacters);
  const originalSelectedCharacters = selected.reduce(
    (sum, chunk) => sum + chunk.text.length,
    0,
  );

  return {
    text,
    fields,
    chunkIds: selected.map((chunk) => chunk.id),
    sectionIds: [...new Set(selected.map((chunk) => chunk.sectionId))],
    characterCount: text.length,
    wasTruncated:
      text.length < joined.length ||
      text.length < originalSelectedCharacters,
  };
}

function scoreChunkAcrossFields(
  chunk: DocumentChunk,
  fields: readonly ExpectedField[],
): number {
  return fields.reduce(
    (score, field) => score + scoreChunkForField(chunk, field),
    0,
  );
}

function scoreChunkForField(
  chunk: DocumentChunk,
  field: ExpectedField,
): number {
  const title = normalise(chunk.sectionTitle);
  const text = normalise(chunk.text);
  let score = 0;

  if (FIELD_ROLES[field].includes(chunk.semanticRole)) {
    score += 18;
  }

  for (const rawHint of FIELD_HINTS[field]) {
    const hint = normalise(rawHint);
    if (!hint) continue;

    if (title.includes(hint)) {
      score += 24;
    }

    score += Math.min(countOccurrences(text, hint), 3) * 7;
  }

  if (["metric", "result", "sample"].includes(field) && /\d/u.test(chunk.text)) {
    score += 4;
  }

  return score;
}

function buildRelevantExcerpt(
  source: string,
  fields: readonly ExpectedField[],
  maxCharacters: number,
): string {
  const sentences = splitSentences(source);

  if (sentences.length === 0) {
    return truncateAtBoundary(source.trim(), maxCharacters);
  }

  const ranked = sentences
    .map((sentence, index) => ({
      index,
      score: scoreSentence(sentence, fields),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.index - right.index,
    );

  const selectedIndexes = new Set<number>();

  for (const match of ranked.slice(0, 4)) {
    selectedIndexes.add(match.index);
    if (match.index > 0) selectedIndexes.add(match.index - 1);
    if (match.index + 1 < sentences.length) {
      selectedIndexes.add(match.index + 1);
    }
  }

  if (selectedIndexes.size === 0) {
    for (let index = 0; index < sentences.length; index += 1) {
      selectedIndexes.add(index);
      const candidate = [...selectedIndexes]
        .sort((a, b) => a - b)
        .map((item) => sentences[item])
        .join(" ");
      if (candidate.length >= maxCharacters * 0.8) break;
    }
  }

  const selected = [...selectedIndexes]
    .sort((a, b) => a - b)
    .map((index) => sentences[index])
    .join(" ")
    .trim();

  return truncateAtBoundary(selected, maxCharacters);
}

function scoreSentence(
  sentence: string,
  fields: readonly ExpectedField[],
): number {
  const text = normalise(sentence);
  let score = 0;

  for (const field of fields) {
    for (const rawHint of FIELD_HINTS[field]) {
      const hint = normalise(rawHint);
      if (hint && text.includes(hint)) {
        score += 6;
      }
    }

    if (
      ["metric", "result", "sample"].includes(field) &&
      /\d/u.test(sentence)
    ) {
      score += 2;
    }
  }

  return score;
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?。！？])\s+|[\r\n]+/u)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

function countOccurrences(value: string, needle: string): number {
  if (!needle) return 0;

  let count = 0;
  let cursor = 0;

  while (cursor < value.length) {
    const found = value.indexOf(needle, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + needle.length;
  }

  return count;
}

function truncateAtBoundary(
  value: string,
  maxCharacters: number,
): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxCharacters) return trimmed;

  const candidate = trimmed.slice(0, maxCharacters);
  const boundary = Math.max(
    candidate.lastIndexOf("\n\n"),
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("。"),
  );

  return candidate
    .slice(
      0,
      boundary >= maxCharacters * 0.62
        ? boundary + (candidate[boundary] === "。" ? 1 : 0)
        : candidate.length,
    )
    .trim();
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}%+.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanHeading(value: string): string {
  return value.replace(/\s+/gu, " ").trim() || "Document evidence";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

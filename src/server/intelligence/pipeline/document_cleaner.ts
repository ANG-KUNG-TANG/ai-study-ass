import type { RawDocument, CleanedDocument, CleaningStats } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Headings that signal the start of a references / bibliography section.
 * Everything from this point on is dropped — reference lists add noise
 * to NLP without contributing to knowledge extraction.
 */
const REFERENCES_HEADINGS = [
  /^references$/i,
  /^bibliography$/i,
  /^works cited$/i,
  /^citations$/i,
];

/**
 * Matches inline citation markers common in academic papers:
 *   [1], [1,2], [1-3], [Smith, 2020], [Smith et al., 2020]
 */
const INLINE_CITATION_RE =
  /\[(?:\d+(?:[,–\-]\d+)*|[A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4})\]/g;

/**
 * Matches parenthetical citations including semicolon-separated lists:
 *   (Smith, 2020)
 *   (Smith et al., 2020)
 *   (Smith & Jones, 2020)
 *   (Smith et al., 2021; Jones & Brown, 2019)
 *   (LeCun et al., 2021; Krizhevsky & Sutskever, 2012)
 *
 * Uses [a-zA-Z]+ for surname suffixes to handle mixed-case names
 * like MacLeod, Sutskever, LeCun.
 */
const PAREN_CITATION_RE =
  /\((?:[A-Z][a-zA-Z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-zA-Z]+))?,\s*\d{4})(?:;\s*(?:[A-Z][a-zA-Z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-zA-Z]+))?,\s*\d{4}))*\)/g;

/**
 * A line that is only a page number — optionally preceded/followed
 * by whitespace, and possibly "Page N" or "- N -" variants.
 */
const PAGE_NUMBER_RE = /^(?:[-–—]?\s*(?:page\s+)?\d+\s*[-–—]?)$/i;

/**
 * Running headers/footers often contain the paper title, conference name,
 * or author names repeated on every page. We detect them by looking for
 * short lines (≤ 80 chars) that appear 3+ times identically in the text.
 */
const RUNNING_HEADER_MIN_OCCURRENCES = 3;
const RUNNING_HEADER_MAX_LENGTH = 80;

/**
 * Sequences of more than two blank lines collapse to two.
 */
const EXCESS_BLANK_LINES_RE = /\n{3,}/g;

/**
 * Hyphenated line breaks from PDF extraction: "meth-\nod" → "method"
 */
const HYPHEN_LINE_BREAK_RE = /(\w)-\n(\w)/g;

/**
 * A lone newline that splits a sentence mid-flow.
 * Detected by: previous char is a lowercase letter or comma,
 * next char is a lowercase letter.
 */
const MID_SENTENCE_LINE_BREAK_RE = /([a-z,])\n([a-z])/g;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Clean raw text extracted from an academic PDF or DOCX.
 *
 * Pipeline (in order — order matters):
 *   1. Detect and drop the references section tail
 *   2. Split into lines
 *   3. Remove page-number lines
 *   4. Remove repeated running headers/footers
 *   5. Rejoin and fix hyphenated line breaks
 *   6. Fix mid-sentence line breaks
 *   7. Strip inline and parenthetical citation markers
 *   8. Collapse excess blank lines
 *   9. Final trim
 */
export function cleanDocument(raw: RawDocument): CleanedDocument {
  const stats: CleaningStats = {
    rawLength: raw.rawText.length,
    cleanLength: 0,
    pageNumbersRemoved: 0,
    citationsRemoved: 0,
    referenceLinesRemoved: 0,
    referencesSectionTruncated: false,
  };

  // Step 1 — drop the references section tail
  let text = truncateAtReferencesSection(raw.rawText, stats);

  // Step 2–4 — line-level cleaning
  const lines = text.split("\n");
  const runningHeaders = detectRunningHeaders(lines);
  const cleanedLines = processLines(lines, runningHeaders, stats);

  // Step 5 — rejoin
  text = cleanedLines.join("\n");

  // Step 6 — fix PDF hyphenated line breaks: "meth-\nod" → "method"
  text = text.replace(HYPHEN_LINE_BREAK_RE, "$1$2");

  // Step 7 — fix mid-sentence line breaks
  text = text.replace(MID_SENTENCE_LINE_BREAK_RE, "$1 $2");

  // Step 8 — strip citation markers and count them
  text = stripCitations(text, stats);

  // Step 9 — collapse excess blank lines
  text = text.replace(EXCESS_BLANK_LINES_RE, "\n\n");

  // Step 10 — clean up spaces left behind by citation removal: "vision ." → "vision."
  text = text.replace(/\s+([.,;:!?])/g, "$1");

  // Step 11 — final trim
  text = text.trim();

  stats.cleanLength = text.length;

  return {
    cleanText: text,
    fileName: raw.fileName,
    mimeType: raw.mimeType,
    fileSize: raw.fileSize,
    pageCount: raw.pageCount,
    cleaningStats: stats,
  };
}

// ─── Step 1: references section truncation ────────────────────────────────────

function truncateAtReferencesSection(
  text: string,
  stats: CleaningStats
): string {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // A references heading is a short line (≤ 30 chars) matching our patterns
    if (trimmed.length <= 30 && REFERENCES_HEADINGS.some((re) => re.test(trimmed))) {
      stats.referencesSectionTruncated = true;
      stats.referenceLinesRemoved = lines.length - i;
      // Keep the heading itself so the section detector can find it,
      // but drop everything after it
      return lines.slice(0, i + 1).join("\n");
    }
  }

  return text;
}

// ─── Step 3: running header detection ────────────────────────────────────────

/**
 * Build a set of lines that appear ≥ RUNNING_HEADER_MIN_OCCURRENCES times
 * and are short enough to be a header/footer rather than body text.
 */
function detectRunningHeaders(lines: string[]): Set<string> {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > RUNNING_HEADER_MAX_LENGTH) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  const headers = new Set<string>();
  for (const [line, count] of counts) {
    if (count >= RUNNING_HEADER_MIN_OCCURRENCES) {
      headers.add(line);
    }
  }

  return headers;
}

// ─── Steps 2–4: line processing ───────────────────────────────────────────────

function processLines(
  lines: string[],
  runningHeaders: Set<string>,
  stats: CleaningStats
): string[] {
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Drop blank-ish lines that are just whitespace
    if (trimmed.length === 0) {
      result.push("");
      continue;
    }

    // Drop page number lines
    if (PAGE_NUMBER_RE.test(trimmed)) {
      stats.pageNumbersRemoved++;
      continue;
    }

    // Drop running headers/footers
    if (runningHeaders.has(trimmed)) {
      continue;
    }

    result.push(line);
  }

  return result;
}

// ─── Step 8: citation stripping ───────────────────────────────────────────────

function stripCitations(text: string, stats: CleaningStats): string {
  let count = 0;

  const after_inline = text.replace(INLINE_CITATION_RE, () => {
    count++;
    return "";
  });

  const after_paren = after_inline.replace(PAREN_CITATION_RE, () => {
    count++;
    return "";
  });

  stats.citationsRemoved = count;
  return after_paren;
}
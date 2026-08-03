import type { TextQualityReport } from "./types";

const PAGE_NUMBER_RE = /^(?:[-–—]?\s*(?:page\s+)?\d+\s*[-–—]?)$/i;
const REPLACEMENT_RE = /[\uFFFD\u0000]/g;
const CONTROL_RE = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const GREEK_RE = /\p{Script=Greek}/gu;
const LATIN_RE = /\p{Script=Latin}/gu;
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/gu;
const SUSPICIOUS_SYMBOL_RE = /[^\p{L}\p{N}\p{P}\p{Z}\n\r\t]/gu;
const GENERIC_PAGE_LINE_RE = /^(?:case\s+id\s+\w+|noname\s+manuscript|will\s+be\s+inserted\s+by\s+the\s+editor)$/i;

export interface ReliableCleanResult {
  text: string;
  quality: TextQualityReport;
  removedCorruptLines: number;
  removedRepeatedLines: number;
  removedPageNumbers: number;
}

export function normaliseLine(line: string): string {
  return line
    .normalize("NFKC")
    .replace(REPLACEMENT_RE, "")
    .replace(CONTROL_RE, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function normaliseRepeatedLineKey(line: string): string {
  return normaliseLine(line)
    .toLowerCase()
    .replace(/\bpage\s+\d+\b/g, "page #")
    .replace(/\b\d+\b/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export function corruptedCharacterRatio(text: string): number {
  const chars = [...text];
  if (chars.length === 0) return 0;

  const suspicious = text.match(SUSPICIOUS_SYMBOL_RE)?.length ?? 0;
  const replacement = text.match(REPLACEMENT_RE)?.length ?? 0;
  const controls = text.match(CONTROL_RE)?.length ?? 0;

  return Math.min(1, (suspicious + replacement * 2 + controls * 2) / chars.length);
}

export function greekCharacterRatio(text: string): number {
  const chars = [...text].filter((character) => !/\s/u.test(character));
  if (chars.length === 0) return 0;
  return (text.match(GREEK_RE)?.length ?? 0) / chars.length;
}

export function readableCharacterRatio(text: string): number {
  const chars = [...text].filter((character) => !/\s/u.test(character));
  if (chars.length === 0) return 0;
  return (text.match(LETTER_OR_NUMBER_RE)?.length ?? 0) / chars.length;
}

export function hasEncodingNoise(text: string): boolean {
  const cleaned = normaliseLine(text);
  if (cleaned.length < 12) return false;

  const greek = greekCharacterRatio(cleaned);
  const latin = (cleaned.match(LATIN_RE)?.length ?? 0) / Math.max(1, [...cleaned].length);
  const suspicious = corruptedCharacterRatio(cleaned);
  const readable = readableCharacterRatio(cleaned);
  const commonEnglishWords = cleaned.match(/\b(the|and|of|to|in|for|with|is|are|case|study)\b/gi)?.length ?? 0;

  return (
    suspicious > 0.08 ||
    readable < 0.48 ||
    (greek > 0.22 && latin < 0.18 && commonEnglishWords === 0)
  );
}

function splitPages(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const formFeedPages = normalized.split(/\f+/).map((page) => page.trim());

  if (formFeedPages.filter(Boolean).length > 1) {
    return formFeedPages.filter(Boolean);
  }

  return [normalized];
}

function repeatedPageLineKeys(pages: string[]): Set<string> {
  const counts = new Map<string, number>();

  for (const page of pages) {
    const unique = new Set(
      page
        .split("\n")
        .map(normaliseRepeatedLineKey)
        .filter((line) => line.length >= 4 && line.length <= 140),
    );

    for (const line of unique) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }

  const threshold = pages.length > 1
    ? Math.max(2, Math.ceil(pages.length * 0.55))
    : 3;

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([line]) => line),
  );
}

function repeatedGlobalLineKeys(lines: string[]): Set<string> {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const key = normaliseRepeatedLineKey(line);
    if (key.length < 4 || key.length > 140) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= 3)
      .map(([line]) => line),
  );
}

function collapseRepeatedPhrasesInLine(line: string): string {
  const words = normaliseLine(line).split(/\s+/).filter(Boolean);
  if (words.length < 4) return words.join(" ");

  for (let phraseLength = Math.floor(words.length / 2); phraseLength >= 2; phraseLength -= 1) {
    const phrase = words.slice(0, phraseLength).join(" ").toLowerCase();
    let repeats = 1;

    while (
      words
        .slice(repeats * phraseLength, (repeats + 1) * phraseLength)
        .join(" ")
        .toLowerCase() === phrase
    ) {
      repeats += 1;
    }

    if (repeats > 1) {
      return [
        ...words.slice(0, phraseLength),
        ...words.slice(repeats * phraseLength),
      ].join(" ");
    }
  }

  return words.join(" ");
}

function calculateQuality(
  originalText: string,
  cleanedText: string,
  corruptLineCount: number,
  repeatedLineCount: number,
): TextQualityReport {
  const suspiciousCharacterRatio = corruptedCharacterRatio(cleanedText);
  const greekRatio = greekCharacterRatio(cleanedText);
  const readableRatio = readableCharacterRatio(cleanedText);
  const replacementCharacterCount = originalText.match(REPLACEMENT_RE)?.length ?? 0;
  const sourceLineCount = Math.max(1, originalText.split(/\r?\n/).length);
  const linePenalty = Math.min(0.32, (corruptLineCount + repeatedLineCount * 0.35) / sourceLineCount);
  const lengthRetention = Math.min(1, cleanedText.length / Math.max(400, originalText.length * 0.28));

  const score = Math.max(
    0,
    Math.min(
      1,
      1
        - suspiciousCharacterRatio * 2.5
        - Math.max(0, greekRatio - 0.08) * 1.2
        - Math.max(0, 0.62 - readableRatio) * 0.9
        - linePenalty
        - Math.max(0, 0.45 - lengthRetention) * 0.45,
    ),
  );

  const warnings: string[] = [];
  if (corruptLineCount > 0) warnings.push(`${corruptLineCount} corrupt or encoding-noise lines were removed.`);
  if (repeatedLineCount > 0) warnings.push(`${repeatedLineCount} repeated header/footer lines were removed.`);
  if (suspiciousCharacterRatio > 0.04) warnings.push("The remaining text still contains an unusual symbol ratio.");
  if (readableRatio < 0.6) warnings.push("The extracted text has a low readable-character ratio.");
  if (cleanedText.length < 250) warnings.push("Too little usable text remains after cleaning.");

  return {
    score,
    passed: score >= 0.72 && cleanedText.length >= 250,
    suspiciousCharacterRatio,
    greekCharacterRatio: greekRatio,
    readableCharacterRatio: readableRatio,
    corruptLineCount,
    repeatedLineCount,
    replacementCharacterCount,
    warnings,
  };
}

export function cleanTextReliably(text: string): ReliableCleanResult {
  const normalizedText = text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(REPLACEMENT_RE, "")
    .replace(CONTROL_RE, "");

  const pages = splitPages(normalizedText);
  const pageRepeated = repeatedPageLineKeys(pages);
  const allLines = pages.flatMap((page) => page.split("\n"));
  const globalRepeated = repeatedGlobalLineKeys(allLines);

  let removedCorruptLines = 0;
  let removedRepeatedLines = 0;
  let removedPageNumbers = 0;
  const output: string[] = [];
  const preservedRepeatedKeys = new Set<string>();

  for (const rawLine of allLines) {
    const line = collapseRepeatedPhrasesInLine(rawLine);
    const key = normaliseRepeatedLineKey(line);

    if (!line) {
      output.push("");
      continue;
    }

    if (PAGE_NUMBER_RE.test(line)) {
      removedPageNumbers += 1;
      continue;
    }

    if (GENERIC_PAGE_LINE_RE.test(line)) {
      removedRepeatedLines += 1;
      continue;
    }

    if (
      (pageRepeated.has(key) || globalRepeated.has(key)) &&
      line.length <= 140
    ) {
      // Preserve the first clean occurrence. This keeps a real multiline title
      // while still removing the same running header from later pages.
      if (preservedRepeatedKeys.has(key)) {
        removedRepeatedLines += 1;
        continue;
      }
      preservedRepeatedKeys.add(key);
    }

    if (hasEncodingNoise(line)) {
      removedCorruptLines += 1;
      continue;
    }

    output.push(line);
  }

  let cleanedText = output
    .join("\n")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/([a-z,;])\n([a-z])/g, "$1 $2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();

  // A second defensive pass removes any long Greek-like sequence that survived
  // because PDF extraction inserted spaces between glyphs.
  cleanedText = cleanedText
    .split("\n")
    .filter((line) => !hasEncodingNoise(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const quality = calculateQuality(
    normalizedText,
    cleanedText,
    removedCorruptLines,
    removedRepeatedLines,
  );

  return {
    text: cleanedText,
    quality,
    removedCorruptLines,
    removedRepeatedLines,
    removedPageNumbers,
  };
}

export function isUsableText(text: string): boolean {
  const result = cleanTextReliably(text);
  return result.quality.passed;
}

export function cleanTextForStudyFeatures(text: string): string {
  return cleanTextReliably(text).text;
}

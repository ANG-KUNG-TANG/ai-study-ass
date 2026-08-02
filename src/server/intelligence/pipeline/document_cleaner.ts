import type {
  CleanedDocument,
  CleaningStats,
  RawDocument,
  RawDocumentPage,
  SourcePage,
} from "./types";

const REFERENCES_HEADINGS = [
  /^references$/i,
  /^bibliography$/i,
  /^works cited$/i,
  /^citations$/i,
];

const INLINE_CITATION_RE =
  /\[(?:\d+(?:\s*[,–-]\s*\d+)*|[A-Z][a-zA-Z]+(?:\s+et\s+al\.?)?,?\s*\d{4})\]/g;
const PAREN_CITATION_RE =
  /\((?:[A-Z][a-zA-Z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-zA-Z]+))?,\s*\d{4})(?:;\s*(?:[A-Z][a-zA-Z]+(?:\s+(?:et\s+al\.?|&\s+[A-Z][a-zA-Z]+))?,\s*\d{4}))*\)/g;
const PAGE_NUMBER_RE = /^(?:[-–—]?\s*(?:page\s+)?\d+\s*[-–—]?)$/i;
const RUNNING_HEADER_MIN_OCCURRENCES = 3;
const RUNNING_HEADER_MAX_LENGTH = 90;

export function cleanDocument(raw: RawDocument): CleanedDocument {
  const pages = normaliseInputPages(raw);
  const stats: CleaningStats = {
    rawLength: raw.rawText.length,
    cleanLength: 0,
    pageNumbersRemoved: 0,
    citationsRemoved: 0,
    referenceLinesRemoved: 0,
    referencesSectionTruncated: false,
    runningHeadersRemoved: 0,
    hyphenatedBreaksJoined: 0,
  };

  const allLines = pages.flatMap((page) => page.rawText.split(/\r?\n/));
  const runningHeaders = detectRunningHeaders(allLines);
  const sourcePages: SourcePage[] = [];
  let globalOffset = 0;
  let referencesReached = false;

  for (const page of pages) {
    const displayLines: string[] = [];
    const analysisLines: string[] = [];

    for (const line of page.rawText.replace(/\r\n?/g, "\n").split("\n")) {
      const trimmed = line.trim();

      if (trimmed && REFERENCES_HEADINGS.some((pattern) => pattern.test(trimmed))) {
        referencesReached = true;
        stats.referencesSectionTruncated = true;
      }

      if (PAGE_NUMBER_RE.test(trimmed)) {
        stats.pageNumbersRemoved += 1;
        continue;
      }

      if (trimmed && runningHeaders.has(trimmed)) {
        stats.runningHeadersRemoved += 1;
        continue;
      }

      displayLines.push(line);

      if (!referencesReached) {
        analysisLines.push(line);
      } else {
        stats.referenceLinesRemoved += 1;
      }
    }

    const displayText = normaliseLayout(displayLines.join("\n"), stats, false);
    const analysisText = normaliseLayout(
      stripCitations(analysisLines.join("\n"), stats),
      stats,
      true,
    );

    const startOffset = globalOffset;
    const endOffset = startOffset + displayText.length;
    sourcePages.push({
      pageNumber: page.pageNumber,
      rawText: page.rawText,
      displayText,
      analysisText,
      startOffset,
      endOffset,
    });
    globalOffset = endOffset + 2;
  }

  const displayText = sourcePages.map((page) => page.displayText).join("\n\n").trim();
  const analysisText = sourcePages.map((page) => page.analysisText).join("\n\n").trim();
  stats.cleanLength = analysisText.length;

  return {
    sourceText: raw.rawText,
    displayText,
    analysisText,
    cleanText: analysisText,
    sourcePages,
    fileName: raw.fileName,
    mimeType: raw.mimeType,
    fileSize: raw.fileSize,
    pageCount: raw.pageCount ?? sourcePages.length,
    cleaningStats: stats,
  };
}

function normaliseInputPages(raw: RawDocument): RawDocumentPage[] {
  if (raw.pages?.length) {
    return raw.pages.map((page, index) => ({
      pageNumber: page.pageNumber || index + 1,
      rawText: page.rawText,
    }));
  }

  const formFeedPages = raw.rawText.split("\f");
  if (formFeedPages.length > 1) {
    return formFeedPages.map((rawText, index) => ({
      pageNumber: index + 1,
      rawText,
    }));
  }

  return [{ pageNumber: 1, rawText: raw.rawText }];
}

function detectRunningHeaders(lines: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > RUNNING_HEADER_MAX_LENGTH) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= RUNNING_HEADER_MIN_OCCURRENCES)
      .map(([line]) => line),
  );
}

function normaliseLayout(
  input: string,
  stats: CleaningStats,
  collapseMoreAggressively: boolean,
): string {
  let text = input.replace(/\t/g, " ");

  const hyphenMatches = text.match(/(\w)-\n(\w)/g)?.length ?? 0;
  stats.hyphenatedBreaksJoined += hyphenMatches;
  text = text.replace(/(\w)-\n(\w)/g, "$1$2");

  // Join a PDF line-break only when both sides look like a continuing sentence.
  text = text.replace(/([a-z0-9,;:])\n(?=[a-z(])/g, "$1 ");
  text = text.replace(/[ ]{2,}/g, " ");
  text = text.replace(collapseMoreAggressively ? /\n{3,}/g : /\n{4,}/g, "\n\n");
  text = text.replace(/\s+([.,;:!?])/g, "$1");
  return text.trim();
}

function stripCitations(text: string, stats: CleaningStats): string {
  let count = 0;
  const withoutInline = text.replace(INLINE_CITATION_RE, () => {
    count += 1;
    return "";
  });
  const withoutParen = withoutInline.replace(PAREN_CITATION_RE, () => {
    count += 1;
    return "";
  });
  stats.citationsRemoved += count;
  return withoutParen;
}

import type {
  CleanedDocument,
  CleaningStats,
  RawDocument,
  RawDocumentPage,
  SourcePage,
} from "./types";

import {
  cleanTextReliably,
  normaliseLine,
  normaliseRepeatedLineKey,
} from "../reliability/text-quality";

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

const PAGE_NUMBER_RE =
  /^(?:[-–—]?\s*(?:page\s+)?\d+\s*[-–—]?)$/i;

const RUNNING_HEADER_MAX_LENGTH =
  140;

export function cleanDocument(
  raw: RawDocument,
): CleanedDocument {
  const pages =
    normaliseInputPages(
      raw,
    );

  const stats: CleaningStats = {
    rawLength:
      raw.rawText.length,
    cleanLength:
      0,
    pageNumbersRemoved:
      0,
    citationsRemoved:
      0,
    referenceLinesRemoved:
      0,
    referencesSectionTruncated:
      false,
    runningHeadersRemoved:
      0,
    hyphenatedBreaksJoined:
      0,
  };

  const runningHeaders =
    detectRunningHeaders(
      pages,
    );

  const preservedRunningHeaders =
    new Set<string>();

  const sourcePages:
    SourcePage[] = [];

  let globalOffset =
    0;

  let referencesReached =
    false;

  for (
    const page of pages
  ) {
    const displayLines:
      string[] = [];

    const analysisLines:
      string[] = [];

    const rawLines =
      page.rawText
        .replace(
          /\r\n?/g,
          "\n",
        )
        .split(
          "\n",
        );

    for (
      const rawLine of rawLines
    ) {
      const line =
        normaliseLine(
          rawLine,
        );

      if (
        line &&
        REFERENCES_HEADINGS.some(
          (
            pattern,
          ) =>
            pattern.test(
              line,
            ),
        )
      ) {
        referencesReached =
          true;

        stats.referencesSectionTruncated =
          true;
      }

      if (
        PAGE_NUMBER_RE.test(
          line,
        )
      ) {
        stats.pageNumbersRemoved +=
          1;

        continue;
      }

      const repeatedKey =
        normaliseRepeatedLineKey(
          line,
        );

      if (
        line &&
        runningHeaders.has(
          repeatedKey,
        )
      ) {
        if (
          preservedRunningHeaders.has(
            repeatedKey,
          )
        ) {
          stats.runningHeadersRemoved +=
            1;

          continue;
        }

        // Preserve the first occurrence so a real title or section heading is
        // not removed merely because it also appears as a later page header.
        preservedRunningHeaders.add(
          repeatedKey,
        );
      }

      displayLines.push(
        line,
      );

      if (
        !referencesReached
      ) {
        analysisLines.push(
          line,
        );
      } else if (
        line
      ) {
        stats.referenceLinesRemoved +=
          1;
      }
    }

    const displayLayout =
      normaliseLayout(
        displayLines.join(
          "\n",
        ),
        stats,
        false,
        true,
      );

    const analysisLayout =
      normaliseLayout(
        stripCitations(
          analysisLines.join(
            "\n",
          ),
          stats,
        ),
        stats,
        true,
        false,
      );

    const reliableDisplay =
      cleanTextReliably(
        displayLayout,
      );

    const reliableAnalysis =
      cleanTextReliably(
        analysisLayout,
      );

    // These removals happen after the page-aware pass, so add them once from
    // the display representation. The analysis representation contains the
    // same header and page-number candidates.
    stats.pageNumbersRemoved +=
      reliableDisplay.removedPageNumbers;

    stats.runningHeadersRemoved +=
      reliableDisplay.removedRepeatedLines;

    const displayText =
      reliableDisplay.text;

    const analysisText =
      reliableAnalysis.text;

    const startOffset =
      globalOffset;

    const endOffset =
      startOffset +
      displayText.length;

    sourcePages.push({
      pageNumber:
        page.pageNumber,
      rawText:
        page.rawText,
      displayText,
      analysisText,
      startOffset,
      endOffset,
    });

    globalOffset =
      endOffset + 2;
  }

  const displayText =
    sourcePages
      .map(
        (
          page,
        ) =>
          page.displayText,
      )
      .filter(
        Boolean,
      )
      .join(
        "\n\n",
      )
      .trim();

  const analysisText =
    sourcePages
      .map(
        (
          page,
        ) =>
          page.analysisText,
      )
      .filter(
        Boolean,
      )
      .join(
        "\n\n",
      )
      .trim();

  stats.cleanLength =
    analysisText.length;

  return {
    sourceText:
      raw.rawText,
    displayText,
    analysisText,
    cleanText:
      analysisText,
    sourcePages,
    fileName:
      raw.fileName,
    mimeType:
      raw.mimeType,
    fileSize:
      raw.fileSize,
    pageCount:
      raw.pageCount ??
      sourcePages.length,
    cleaningStats:
      stats,
  };
}

function normaliseInputPages(
  raw: RawDocument,
): RawDocumentPage[] {
  if (
    raw.pages?.length
  ) {
    return raw.pages.map(
      (
        page,
        index,
      ) => ({
        pageNumber:
          page.pageNumber ||
          index + 1,
        rawText:
          page.rawText,
      }),
    );
  }

  const formFeedPages =
    raw.rawText.split(
      "\f",
    );

  if (
    formFeedPages.length >
    1
  ) {
    return formFeedPages.map(
      (
        rawText,
        index,
      ) => ({
        pageNumber:
          index + 1,
        rawText,
      }),
    );
  }

  return [
    {
      pageNumber:
        1,
      rawText:
        raw.rawText,
    },
  ];
}

function detectRunningHeaders(
  pages: RawDocumentPage[],
): Set<string> {
  if (
    pages.length <
    2
  ) {
    return new Set();
  }

  const counts =
    new Map<
      string,
      number
    >();

  for (
    const page of pages
  ) {
    const uniqueLines =
      new Set(
        page.rawText
          .replace(
            /\r\n?/g,
            "\n",
          )
          .split(
            "\n",
          )
          .map(
            (
              line,
            ) =>
              normaliseRepeatedLineKey(
                line,
              ),
          )
          .filter(
            (
              line,
            ) =>
              line.length >=
                4 &&
              line.length <=
                RUNNING_HEADER_MAX_LENGTH,
          ),
      );

    for (
      const line of uniqueLines
    ) {
      counts.set(
        line,
        (
          counts.get(
            line,
          ) ?? 0
        ) + 1,
      );
    }
  }

  const threshold =
    Math.max(
      2,
      Math.ceil(
        pages.length *
          0.55,
      ),
    );

  return new Set(
    [
      ...counts.entries(),
    ]
      .filter(
        (
          [
            ,
            count,
          ],
        ) =>
          count >=
          threshold,
      )
      .map(
        (
          [
            line,
          ],
        ) =>
          line,
      ),
  );
}

function normaliseLayout(
  input: string,
  stats: CleaningStats,
  collapseMoreAggressively: boolean,
  trackHyphenation: boolean,
): string {
  let text =
    input.replace(
      /\t/g,
      " ",
    );

  if (
    trackHyphenation
  ) {
    const hyphenMatches =
      text.match(
        /(\p{L})-\n(\p{Ll})/gu,
      )?.length ?? 0;

    stats.hyphenatedBreaksJoined +=
      hyphenMatches;
  }

  text =
    text.replace(
      /(\p{L})-\n(\p{Ll})/gu,
      "$1$2",
    );

  // Join a PDF line break only when both sides look like one continuing
  // sentence. Uppercase headings and list items retain their line boundaries.
  text =
    text.replace(
      /([a-z0-9,;:])\n(?=[a-z(])/g,
      "$1 ",
    );

  text =
    text.replace(
      /[ ]{2,}/g,
      " ",
    );

  text =
    text.replace(
      collapseMoreAggressively
        ? /\n{3,}/g
        : /\n{4,}/g,
      "\n\n",
    );

  text =
    text.replace(
      /\s+([.,;:!?])/g,
      "$1",
    );

  return text.trim();
}

function stripCitations(
  text: string,
  stats: CleaningStats,
): string {
  let count =
    0;

  const withoutInline =
    text.replace(
      INLINE_CITATION_RE,
      () => {
        count +=
          1;

        return "";
      },
    );

  const withoutParenthetical =
    withoutInline.replace(
      PAREN_CITATION_RE,
      () => {
        count +=
          1;

        return "";
      },
    );

  stats.citationsRemoved +=
    count;

  return withoutParenthetical;
}

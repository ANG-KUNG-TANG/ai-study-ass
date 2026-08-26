import { MAX_CONTENT_LENGTH } from "@/server/utils/constants";
import { FileError } from "@/server/utils/errors";

export type ExtractionQualityStatus =
  | "good"
  | "warning"
  | "failed";

export type ExtractionQualitySeverity =
  | "warning"
  | "error";

export type ExtractionQualityReasonCode =
  | "EMPTY_OR_WHITESPACE"
  | "VERY_SHORT_TEXT"
  | "LOW_READABLE_RATIO"
  | "LOW_ALPHANUMERIC_RATIO"
  | "REPLACEMENT_CHARACTER_NOISE"
  | "CONTROL_CHARACTER_NOISE"
  | "REPEATED_SYMBOL_NOISE"
  | "HIGH_DUPLICATE_LINE_RATIO"
  | "LOW_PAGE_COVERAGE"
  | "LOW_PDF_TEXT_DENSITY"
  | "TRUNCATED_AT_CONTENT_LIMIT";

export interface ExtractionQualityReason {
  code: ExtractionQualityReasonCode;
  severity: ExtractionQualitySeverity;
  message: string;
}

export interface ExtractionQualityMetrics {
  charCount: number;
  nonWhitespaceChars: number;
  wordLikeTokenCount: number;
  lineCount: number;
  uniqueLineRatio: number;
  readableRatio: number;
  alphanumericRatio: number;
  replacementCharacterRatio: number;
  controlCharacterRatio: number;
  repeatedSymbolRunCount: number;

  pageCount: number | null;
  pagesWithText: number | null;
  pageCoverageRatio: number | null;
  averageCharsPerPage: number | null;
  extractedPageNumbers: number[];
  missingPageNumbers: number[];

  truncatedAtContentLimit: boolean;
}

export interface ExtractionQualityReport {
  status: ExtractionQualityStatus;
  usable: boolean;
  score: number;
  reasons: ExtractionQualityReason[];
  metrics: ExtractionQualityMetrics;
}

export interface ExtractionQualityPage {
  pageNumber: number;
  rawText: string;
}

export interface AssessExtractionQualityInput {
  fileType: "pdf" | "docx";
  content: string;
  pageCount?: number;
  pages?: ExtractionQualityPage[];

  /**
   * Injectable for tests. Production callers should normally omit it.
   */
  maxContentLength?: number;
}

interface WeightedReason extends ExtractionQualityReason {
  penalty: number;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function round(value: number, digits = 4): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function normaliseLine(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addReason(
  reasons: WeightedReason[],
  reason: ExtractionQualityReason,
  penalty: number,
): void {
  if (reasons.some((entry) => entry.code === reason.code)) {
    return;
  }

  reasons.push({
    ...reason,
    penalty,
  });
}

function buildPageMetrics(
  input: AssessExtractionQualityInput,
  charCount: number,
): Pick<
  ExtractionQualityMetrics,
  | "pageCount"
  | "pagesWithText"
  | "pageCoverageRatio"
  | "averageCharsPerPage"
  | "extractedPageNumbers"
  | "missingPageNumbers"
> {
  if (input.fileType !== "pdf") {
    return {
      pageCount: null,
      pagesWithText: null,
      pageCoverageRatio: null,
      averageCharsPerPage: null,
      extractedPageNumbers: [],
      missingPageNumbers: [],
    };
  }

  const pageCount =
    typeof input.pageCount === "number" &&
    Number.isFinite(input.pageCount) &&
    input.pageCount > 0
      ? Math.floor(input.pageCount)
      : null;

  const pages = input.pages ?? [];
  const pageText = new Map<number, string>();

  for (const page of pages) {
    if (
      !Number.isInteger(page.pageNumber) ||
      page.pageNumber <= 0
    ) {
      continue;
    }

    const previous = pageText.get(page.pageNumber) ?? "";
    pageText.set(
      page.pageNumber,
      `${previous}\n${page.rawText ?? ""}`.trim(),
    );
  }

  const extractedPageNumbers = [...pageText.entries()]
    .filter(([, text]) => text.trim().length > 0)
    .map(([pageNumber]) => pageNumber)
    .sort((a, b) => a - b);

  const pagesWithText = extractedPageNumbers.length;
  const extractedSet = new Set(extractedPageNumbers);

  const missingPageNumbers =
    pageCount === null
      ? []
      : Array.from(
          { length: Math.min(pageCount, 500) },
          (_, index) => index + 1,
        )
          .filter((pageNumber) => !extractedSet.has(pageNumber))
          .slice(0, 50);

  return {
    pageCount,
    pagesWithText,
    pageCoverageRatio:
      pageCount === null
        ? null
        : round(Math.min(1, ratio(pagesWithText, pageCount))),
    averageCharsPerPage:
      pageCount === null
        ? null
        : round(ratio(charCount, pageCount), 2),
    extractedPageNumbers,
    missingPageNumbers,
  };
}

export function assessExtractionQuality(
  input: AssessExtractionQualityInput,
): ExtractionQualityReport {
  const content = input.content ?? "";
  const trimmed = content.trim();
  const charCount = trimmed.length;
  const nonWhitespaceChars = countMatches(trimmed, /\S/gu);

  const letterOrNumberCount = countMatches(
    trimmed,
    /[\p{L}\p{N}]/gu,
  );
  const wordLikeTokenCount = countMatches(
    trimmed,
    /[\p{L}\p{N}]+/gu,
  );

  const controlCharacterCount = countMatches(
    trimmed,
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
  );
  const replacementCharacterCount = countMatches(
    trimmed,
    /\uFFFD/g,
  );
  const readableCharacterCount = Math.max(
    0,
    charCount - controlCharacterCount,
  );

  const repeatedSymbolRunCount = countMatches(
    trimmed,
    /([^\p{L}\p{N}\s])\1{5,}/gu,
  );

  const lines = trimmed
    .split(/\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const uniqueLines = new Set(
    lines.map(normaliseLine).filter(Boolean),
  );

  const maxContentLength =
    typeof input.maxContentLength === "number" &&
    Number.isFinite(input.maxContentLength) &&
    input.maxContentLength > 0
      ? Math.floor(input.maxContentLength)
      : MAX_CONTENT_LENGTH;

  const truncatedAtContentLimit =
    maxContentLength > 0 &&
    content.length >= Math.floor(maxContentLength * 0.995);

  const pageMetrics = buildPageMetrics(input, charCount);

  const metrics: ExtractionQualityMetrics = {
    charCount,
    nonWhitespaceChars,
    wordLikeTokenCount,
    lineCount: lines.length,
    uniqueLineRatio:
      lines.length === 0
        ? 0
        : round(uniqueLines.size / lines.length),
    readableRatio:
      charCount === 0
        ? 0
        : round(readableCharacterCount / charCount),
    alphanumericRatio:
      nonWhitespaceChars === 0
        ? 0
        : round(letterOrNumberCount / nonWhitespaceChars),
    replacementCharacterRatio:
      charCount === 0
        ? 0
        : round(replacementCharacterCount / charCount),
    controlCharacterRatio:
      charCount === 0
        ? 0
        : round(controlCharacterCount / charCount),
    repeatedSymbolRunCount,
    ...pageMetrics,
    truncatedAtContentLimit,
  };

  const reasons: WeightedReason[] = [];

  if (charCount === 0) {
    addReason(
      reasons,
      {
        code: "EMPTY_OR_WHITESPACE",
        severity: "error",
        message:
          "The parser did not produce readable text.",
      },
      70,
    );
  } else if (charCount < 120) {
    addReason(
      reasons,
      {
        code: "VERY_SHORT_TEXT",
        severity: "error",
        message:
          "The extracted text is too short to support reliable study-material generation.",
      },
      45,
    );
  } else if (charCount < 300) {
    addReason(
      reasons,
      {
        code: "VERY_SHORT_TEXT",
        severity: "warning",
        message:
          "The extracted text is unusually short; generated study material may have limited coverage.",
      },
      10,
    );
  }

  if (charCount >= 120) {
    if (metrics.readableRatio < 0.86) {
      addReason(
        reasons,
        {
          code: "LOW_READABLE_RATIO",
          severity: "error",
          message:
            "Too many control or unreadable characters were detected.",
        },
        35,
      );
    } else if (metrics.readableRatio < 0.97) {
      addReason(
        reasons,
        {
          code: "LOW_READABLE_RATIO",
          severity: "warning",
          message:
            "The extraction contains an unusual amount of unreadable character data.",
        },
        10,
      );
    }

    if (metrics.alphanumericRatio < 0.2) {
      addReason(
        reasons,
        {
          code: "LOW_ALPHANUMERIC_RATIO",
          severity: "error",
          message:
            "The extraction is dominated by symbols rather than natural-language or numeric content.",
        },
        35,
      );
    } else if (metrics.alphanumericRatio < 0.35) {
      addReason(
        reasons,
        {
          code: "LOW_ALPHANUMERIC_RATIO",
          severity: "warning",
          message:
            "The extraction contains an unusually high proportion of symbols.",
        },
        10,
      );
    }

    if (metrics.replacementCharacterRatio > 0.04) {
      addReason(
        reasons,
        {
          code: "REPLACEMENT_CHARACTER_NOISE",
          severity: "error",
          message:
            "The extraction contains many Unicode replacement characters, suggesting broken text decoding.",
        },
        35,
      );
    } else if (metrics.replacementCharacterRatio > 0.005) {
      addReason(
        reasons,
        {
          code: "REPLACEMENT_CHARACTER_NOISE",
          severity: "warning",
          message:
            "The extraction contains replacement characters that may indicate partial decoding damage.",
        },
        10,
      );
    }

    if (metrics.controlCharacterRatio > 0.02) {
      addReason(
        reasons,
        {
          code: "CONTROL_CHARACTER_NOISE",
          severity: "error",
          message:
            "The extraction contains excessive control-character noise.",
        },
        30,
      );
    } else if (metrics.controlCharacterRatio > 0.002) {
      addReason(
        reasons,
        {
          code: "CONTROL_CHARACTER_NOISE",
          severity: "warning",
          message:
            "The extraction contains some unexpected control characters.",
        },
        8,
      );
    }

    const symbolRunWarningThreshold = Math.max(
      3,
      Math.floor(charCount / 1500),
    );
    const symbolRunFailureThreshold = Math.max(
      10,
      Math.floor(charCount / 400),
    );

    if (
      repeatedSymbolRunCount >=
      symbolRunFailureThreshold
    ) {
      addReason(
        reasons,
        {
          code: "REPEATED_SYMBOL_NOISE",
          severity: "error",
          message:
            "The extraction contains extensive repeated-symbol noise.",
        },
        30,
      );
    } else if (
      repeatedSymbolRunCount >=
      symbolRunWarningThreshold
    ) {
      addReason(
        reasons,
        {
          code: "REPEATED_SYMBOL_NOISE",
          severity: "warning",
          message:
            "Repeated-symbol runs were detected and may indicate extraction corruption.",
        },
        8,
      );
    }

    if (
      metrics.lineCount >= 20 &&
      metrics.uniqueLineRatio < 0.16
    ) {
      addReason(
        reasons,
        {
          code: "HIGH_DUPLICATE_LINE_RATIO",
          severity: "error",
          message:
            "Most extracted lines are duplicates, suggesting a parser or page-reconstruction problem.",
        },
        30,
      );
    } else if (
      metrics.lineCount >= 20 &&
      metrics.uniqueLineRatio < 0.4
    ) {
      addReason(
        reasons,
        {
          code: "HIGH_DUPLICATE_LINE_RATIO",
          severity: "warning",
          message:
            "Many extracted lines are duplicated; generated material may overrepresent repeated content.",
        },
        8,
      );
    }
  }

  if (
    input.fileType === "pdf" &&
    metrics.pageCount !== null &&
    metrics.pageCount >= 4 &&
    metrics.pageCoverageRatio !== null
  ) {
    if (metrics.pageCoverageRatio < 0.25) {
      addReason(
        reasons,
        {
          code: "LOW_PAGE_COVERAGE",
          severity: "error",
          message:
            "Readable text was extracted from fewer than 25% of PDF pages.",
        },
        45,
      );
    } else if (metrics.pageCoverageRatio < 0.6) {
      addReason(
        reasons,
        {
          code: "LOW_PAGE_COVERAGE",
          severity: "warning",
          message:
            "A substantial portion of PDF pages produced no readable text.",
        },
        12,
      );
    }

    if (
      metrics.averageCharsPerPage !== null &&
      metrics.averageCharsPerPage < 40
    ) {
      addReason(
        reasons,
        {
          code: "LOW_PDF_TEXT_DENSITY",
          severity: "error",
          message:
            "The PDF has too little extracted text per page for reliable downstream generation.",
        },
        35,
      );
    } else if (
      metrics.averageCharsPerPage !== null &&
      metrics.averageCharsPerPage < 120
    ) {
      addReason(
        reasons,
        {
          code: "LOW_PDF_TEXT_DENSITY",
          severity: "warning",
          message:
            "The PDF has low extracted-text density and may contain scanned or image-heavy pages.",
        },
        10,
      );
    }
  }

  if (truncatedAtContentLimit) {
    addReason(
      reasons,
      {
        code: "TRUNCATED_AT_CONTENT_LIMIT",
        severity: "warning",
        message:
          "The extracted text reached the configured content limit, so downstream study material may not cover the complete document.",
      },
      12,
    );
  }

  const hasError = reasons.some(
    (reason) => reason.severity === "error",
  );
  const hasWarning = reasons.some(
    (reason) => reason.severity === "warning",
  );

  let score = Math.max(
    0,
    100 -
      reasons.reduce(
        (sum, reason) => sum + reason.penalty,
        0,
      ),
  );

  if (hasError) {
    score = Math.min(score, 54);
  } else if (hasWarning) {
    score = Math.min(score, 89);
  }

  const status: ExtractionQualityStatus = hasError
    ? "failed"
    : hasWarning
      ? "warning"
      : "good";

  return {
    status,
    usable: status !== "failed",
    score,
    reasons: reasons.map(
      ({ penalty: _penalty, ...reason }) => reason,
    ),
    metrics,
  };
}

export class ExtractionQualityError extends FileError {
  readonly report: ExtractionQualityReport;

  constructor(report: ExtractionQualityReport) {
    const explanation =
      report.reasons
        .filter((reason) => reason.severity === "error")
        .map((reason) => reason.message)
        .join(" ") ||
      "Extracted text is not reliable enough for downstream generation.";

    super(`Extraction quality check failed. ${explanation}`);
    this.name = "ExtractionQualityError";
    this.report = report;
  }
}

export function assertExtractionUsable(
  report: ExtractionQualityReport,
): void {
  if (!report.usable) {
    throw new ExtractionQualityError(report);
  }
}

export function extractionQualityLogContext(
  report: ExtractionQualityReport,
): Record<string, unknown> {
  return {
    extractionQualityStatus: report.status,
    extractionQualityScore: report.score,
    extractionQualityReasons: report.reasons.map(
      (reason) => reason.code,
    ),
    extractionCharCount: report.metrics.charCount,
    extractionPageCount: report.metrics.pageCount,
    extractionPagesWithText: report.metrics.pagesWithText,
    extractionPageCoverage:
      report.metrics.pageCoverageRatio,
    extractionAverageCharsPerPage:
      report.metrics.averageCharsPerPage,
    extractionTruncated:
      report.metrics.truncatedAtContentLimit,
  };
}

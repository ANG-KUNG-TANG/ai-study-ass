import { spawn } from "node:child_process";

import type {
  ExtractionQualityReasonCode,
  ExtractionQualityReport,
} from "@/server/services/extraction-quality.service";
import {
  renderPDFPages,
  type ParsedPDFPage,
} from "@/server/services/pdf.service";

export type SelectiveOcrAction =
  | "skip"
  | "ocr"
  | "blocked";

export interface SelectiveOcrPlan {
  action: SelectiveOcrAction;
  pageNumbers: number[];
  candidatePageNumbers: number[];
  maxPages: number;
  reason:
    | "native_extraction_usable"
    | "no_recoverable_quality_issue"
    | "no_weak_pages"
    | "targeted_recovery"
    | "too_many_weak_pages";
}

export interface OcrRecoveredPage {
  pageNumber: number;
  rawText: string;
}

export interface SelectiveOcrRecoveryResult {
  pages: ParsedPDFPage[];
  attemptedPageNumbers: number[];
  recoveredPageNumbers: number[];
  failedPageNumbers: number[];
}

const DEFAULT_MAX_OCR_PAGES = 24;
const OCR_RENDER_WIDTH = 1_600;
const OCR_PAGE_TIMEOUT_MS = 20_000;
const OCR_MAX_OUTPUT_BYTES = 120_000;

const RECOVERABLE_REASON_CODES = new Set<ExtractionQualityReasonCode>([
  "EMPTY_OR_WHITESPACE",
  "VERY_SHORT_TEXT",
  "LOW_READABLE_RATIO",
  "LOW_ALPHANUMERIC_RATIO",
  "REPLACEMENT_CHARACTER_NOISE",
  "CONTROL_CHARACTER_NOISE",
  "REPEATED_SYMBOL_NOISE",
  "HIGH_DUPLICATE_LINE_RATIO",
  "LOW_PAGE_COVERAGE",
  "LOW_PDF_TEXT_DENSITY",
]);

export function buildSelectiveOcrPlan(input: {
  report: ExtractionQualityReport;
  pages: readonly ParsedPDFPage[];
  pageCount: number;
  maxPages?: number;
}): SelectiveOcrPlan {
  const maxPages = normaliseMaxPages(input.maxPages);

  if (input.report.status === "good") {
    return {
      action: "skip",
      pageNumbers: [],
      candidatePageNumbers: [],
      maxPages,
      reason: "native_extraction_usable",
    };
  }

  const hasRecoverableIssue =
    input.report.reasons.some((reason) =>
      RECOVERABLE_REASON_CODES.has(reason.code),
    );

  if (!hasRecoverableIssue) {
    return {
      action: "skip",
      pageNumbers: [],
      candidatePageNumbers: [],
      maxPages,
      reason: "no_recoverable_quality_issue",
    };
  }

  const pageText = new Map(
    input.pages.map((page) => [
      page.pageNumber,
      page.rawText,
    ]),
  );
  const pageCount = Math.max(
    0,
    Math.floor(input.pageCount),
  );
  const candidates: number[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pageCount;
    pageNumber += 1
  ) {
    const text = pageText.get(pageNumber) ?? "";

    if (isWeakPageText(text)) {
      candidates.push(pageNumber);
    }
  }

  if (candidates.length === 0) {
    return {
      action: "skip",
      pageNumbers: [],
      candidatePageNumbers: [],
      maxPages,
      reason: "no_weak_pages",
    };
  }

  if (candidates.length > maxPages) {
    return {
      action: "blocked",
      pageNumbers: [],
      candidatePageNumbers: candidates,
      maxPages,
      reason: "too_many_weak_pages",
    };
  }

  return {
    action: "ocr",
    pageNumbers: candidates,
    candidatePageNumbers: candidates,
    maxPages,
    reason: "targeted_recovery",
  };
}

export async function recoverPdfPagesWithSelectiveOcr(input: {
  buffer: Buffer;
  nativePages: readonly ParsedPDFPage[];
  pageNumbers: readonly number[];
}): Promise<SelectiveOcrRecoveryResult> {
  const requested = uniquePositivePageNumbers(
    input.pageNumbers,
  );

  if (requested.length === 0) {
    return {
      pages: [...input.nativePages],
      attemptedPageNumbers: [],
      recoveredPageNumbers: [],
      failedPageNumbers: [],
    };
  }

  const rendered = await renderPDFPages(
    input.buffer,
    requested,
    OCR_RENDER_WIDTH,
  );
  const recovered: OcrRecoveredPage[] = [];
  const failedPageNumbers: number[] = [];

  for (const page of rendered) {
    try {
      const text = await recognisePngWithTesseract(
        page.png,
      );

      if (!isUsableOcrText(text)) {
        failedPageNumbers.push(page.pageNumber);
        continue;
      }

      recovered.push({
        pageNumber: page.pageNumber,
        rawText: text,
      });
    } catch {
      failedPageNumbers.push(page.pageNumber);
    }
  }

  const renderedNumbers = new Set(
    rendered.map((page) => page.pageNumber),
  );

  for (const pageNumber of requested) {
    if (
      !renderedNumbers.has(pageNumber) &&
      !failedPageNumbers.includes(pageNumber)
    ) {
      failedPageNumbers.push(pageNumber);
    }
  }

  return {
    pages: mergeRecoveredPages(
      input.nativePages,
      recovered,
    ),
    attemptedPageNumbers: requested,
    recoveredPageNumbers:
      recovered.map((page) => page.pageNumber),
    failedPageNumbers:
      [...new Set(failedPageNumbers)].sort(
        (left, right) => left - right,
      ),
  };
}

export function mergeRecoveredPages(
  nativePages: readonly ParsedPDFPage[],
  recoveredPages: readonly OcrRecoveredPage[],
): ParsedPDFPage[] {
  const merged = new Map<number, string>();

  for (const page of nativePages) {
    merged.set(
      page.pageNumber,
      page.rawText,
    );
  }

  for (const page of recoveredPages) {
    const current =
      merged.get(page.pageNumber) ?? "";

    if (
      isWeakPageText(current) &&
      pageTextQuality(page.rawText) >
        pageTextQuality(current)
    ) {
      merged.set(
        page.pageNumber,
        page.rawText,
      );
    }
  }

  return [...merged.entries()]
    .map(([pageNumber, rawText]) => ({
      pageNumber,
      rawText,
    }))
    .sort(
      (left, right) =>
        left.pageNumber - right.pageNumber,
    );
}

function normaliseMaxPages(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAX_OCR_PAGES;
  }

  return Math.max(
    1,
    Math.min(
      50,
      Math.floor(value),
    ),
  );
}

function uniquePositivePageNumbers(
  values: readonly number[],
): number[] {
  return [
    ...new Set(
      values
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value > 0,
        )
        .map((value) => Math.floor(value)),
    ),
  ].sort(
    (left, right) => left - right,
  );
}

function isWeakPageText(
  value: string,
): boolean {
  const text = value.trim();

  if (text.length < 80) {
    return true;
  }

  const nonWhitespace =
    text.match(/\S/gu)?.length ?? 0;

  if (nonWhitespace === 0) {
    return true;
  }

  const alphanumeric =
    text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const replacements =
    text.match(/\uFFFD/gu)?.length ?? 0;
  const controls =
    text.match(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu,
    )?.length ?? 0;

  const alphanumericRatio =
    alphanumeric / nonWhitespace;
  const replacementRatio =
    replacements / Math.max(1, text.length);
  const controlRatio =
    controls / Math.max(1, text.length);

  return (
    alphanumericRatio < 0.35 ||
    replacementRatio > 0.005 ||
    controlRatio > 0.002
  );
}

function pageTextQuality(
  value: string,
): number {
  const text = value.trim();

  if (!text) {
    return 0;
  }

  const nonWhitespace =
    text.match(/\S/gu)?.length ?? 0;
  const alphanumeric =
    text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const replacements =
    text.match(/\uFFFD/gu)?.length ?? 0;
  const controls =
    text.match(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu,
    )?.length ?? 0;

  const densityScore =
    Math.min(1, text.length / 600);
  const alphanumericScore =
    nonWhitespace === 0
      ? 0
      : alphanumeric / nonWhitespace;
  const noisePenalty =
    (
      replacements +
      controls
    ) / Math.max(1, text.length);

  return Math.max(
    0,
    densityScore * 0.45 +
      alphanumericScore * 0.55 -
      noisePenalty * 4,
  );
}

function isUsableOcrText(
  value: string,
): boolean {
  const text = value.trim();

  if (text.length < 40) {
    return false;
  }

  const nonWhitespace =
    text.match(/\S/gu)?.length ?? 0;
  const alphanumeric =
    text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;

  return (
    nonWhitespace > 0 &&
    alphanumeric / nonWhitespace >= 0.3
  );
}

async function recognisePngWithTesseract(
  png: Buffer,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "tesseract",
      [
        "stdin",
        "stdout",
        "-l",
        "eng",
        "--psm",
        "3",
      ],
      {
        stdio: [
          "pipe",
          "pipe",
          "pipe",
        ],
      },
    );

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const finish = (
      error: Error | null,
      value = "",
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (error) {
        reject(error);
      } else {
        resolve(cleanOcrText(value));
      }
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(
        new Error(
          "OCR page processing timed out",
        ),
      );
    }, OCR_PAGE_TIMEOUT_MS);

    child.on("error", (error) => {
      finish(error);
    });

    child.stdout.on(
      "data",
      (chunk: Buffer) => {
        outputBytes += chunk.length;

        if (
          outputBytes >
          OCR_MAX_OUTPUT_BYTES
        ) {
          child.kill("SIGKILL");
          finish(
            new Error(
              "OCR output exceeded the page limit",
            ),
          );
          return;
        }

        stdout.push(
          Buffer.from(chunk),
        );
      },
    );

    child.stderr.on(
      "data",
      (chunk: Buffer) => {
        if (
          stderr.reduce(
            (total, item) =>
              total + item.length,
            0,
          ) < 8_000
        ) {
          stderr.push(
            Buffer.from(chunk),
          );
        }
      },
    );

    child.on(
      "close",
      (code) => {
        if (settled) return;

        if (code !== 0) {
          const details =
            Buffer.concat(stderr)
              .toString("utf8")
              .replace(/\s+/gu, " ")
              .trim()
              .slice(0, 500);

          finish(
            new Error(
              details
                ? `OCR failed: ${details}`
                : `OCR failed with exit code ${code ?? "unknown"}`,
            ),
          );
          return;
        }

        finish(
          null,
          Buffer.concat(stdout)
            .toString("utf8"),
        );
      },
    );

    child.stdin.on(
      "error",
      (error) => {
        finish(error);
      },
    );

    child.stdin.end(png);
  });
}

function cleanOcrText(
  value: string,
): string {
  return value
    .replace(/\r\n/gu, "\n")
    .replace(/\r/gu, "\n")
    .replace(/\t/gu, " ")
    .replace(/[ ]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

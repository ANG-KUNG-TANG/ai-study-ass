export interface DocumentSample {
  text: string;
  originalChars: number;
  sampledChars: number;
  truncated: boolean;
  segmentCount: number;
}

const SAMPLE_SEPARATOR = "\n\n[… document continues …]\n\n";

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function trimWindowToBoundary(window: string): string {
  const trimmed = window.trim();
  if (trimmed.length < 120) return trimmed;

  const firstBreak = trimmed.search(/[.!?]\s|\n/);
  const lastBreak = Math.max(
    trimmed.lastIndexOf(". "),
    trimmed.lastIndexOf("! "),
    trimmed.lastIndexOf("? "),
    trimmed.lastIndexOf("\n"),
  );

  const start = firstBreak > 0 && firstBreak < 220 ? firstBreak + 1 : 0;
  const end = lastBreak > start + 80 ? lastBreak + 1 : trimmed.length;
  return trimmed.slice(start, end).trim();
}

export function sampleDocumentContent(
  sourceText: string,
  maxChars = 20_000,
): DocumentSample {
  const text = normalize(sourceText);
  const safeMaxChars = Math.max(1_000, maxChars);

  if (text.length <= safeMaxChars) {
    return {
      text,
      originalChars: text.length,
      sampledChars: text.length,
      truncated: false,
      segmentCount: text ? 1 : 0,
    };
  }

  const segmentCount = 5;
  const separatorBudget = SAMPLE_SEPARATOR.length * (segmentCount - 1);
  const usableBudget = Math.max(500, safeMaxChars - separatorBudget);
  const windowSize = Math.floor(usableBudget / segmentCount);
  const maxStart = Math.max(0, text.length - windowSize);
  const ratios = [0, 0.25, 0.5, 0.75, 1];

  const overlapContext = Math.min(180, Math.floor(windowSize * 0.18));

  const windows = ratios.map((ratio) => {
    const idealStart = Math.floor(maxStart * ratio);
    const start =
      ratio === 0
        ? 0
        : ratio === 1
          ? maxStart
          : Math.max(0, Math.min(maxStart, idealStart - overlapContext));

    return trimWindowToBoundary(text.slice(start, start + windowSize));
  });

  const uniqueWindows = windows.filter((window, index, all) => {
    if (!window) return false;
    return all.findIndex((candidate) => candidate === window) === index;
  });

  const sampled = uniqueWindows.join(SAMPLE_SEPARATOR).slice(0, safeMaxChars);

  return {
    text: sampled,
    originalChars: text.length,
    sampledChars: sampled.length,
    truncated: true,
    segmentCount: uniqueWindows.length,
  };
}

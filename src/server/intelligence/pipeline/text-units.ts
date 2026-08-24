export type TextUnitKind = "bullet" | "numbered" | "sentence" | "label";

export interface TextUnit {
  text: string;
  kind: TextUnitKind;
  order: number;
}

const BULLET_PREFIX = /^[\u2022\u25AA\u25E6\u2023\u2043*+-]\s*/u;
const NUMBERED_PREFIX = /^(?:\d+(?:\.\d+)*[.)]|[A-Za-z][.)])\s+/;
const INLINE_BULLET = /\s*[\u2022\u25AA\u25E6\u2023\u2043]\s*/gu;

/**
 * Split analysis text without destroying list boundaries. PDF extraction often
 * places several bullets on one visual line; converting those markers back to
 * line boundaries prevents unrelated phrases from becoming one false concept.
 */
export function splitTextUnits(text: string): TextUnit[] {
  const prepared = text
    .replace(/\r\n?/g, "\n")
    .replace(INLINE_BULLET, "\n• ")
    .replace(/\n{3,}/g, "\n\n");

  const units: TextUnit[] = [];

  for (const rawLine of prepared.split("\n")) {
    const line = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!line) continue;

    const bullet = BULLET_PREFIX.test(line);
    const numbered = NUMBERED_PREFIX.test(line);
    const withoutMarker = line
      .replace(BULLET_PREFIX, "")
      .replace(NUMBERED_PREFIX, "")
      .trim();

    if (!withoutMarker) continue;

    const parts = splitSentences(withoutMarker);
    const kind: TextUnitKind = bullet
      ? "bullet"
      : numbered
        ? "numbered"
        : looksLikeLabel(withoutMarker)
          ? "label"
          : "sentence";

    for (const part of parts) {
      units.push({
        text: part,
        kind,
        order: units.length,
      });
    }
  }

  return units;
}

function splitSentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}])/u)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function looksLikeLabel(value: string): boolean {
  const words = value.replace(/[():]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 10 || /[.!?]$/.test(value)) {
    return false;
  }

  const titleWords = words.filter((word) =>
    /^(?:[A-Z][A-Za-z0-9&/-]*|[A-Z]{2,})$/.test(word),
  );

  return titleWords.length / words.length >= 0.75;
}

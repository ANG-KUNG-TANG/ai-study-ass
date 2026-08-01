import type {
  CleanedDocument,
  SectionedDocument,
  DocumentSection,
  SectionTitle,
} from "./types";

// ─── Heading detection ────────────────────────────────────────────────────────

/**
 * A line is treated as a section heading if it matches at least one of:
 *   • Numbered heading:   "1.", "2.1", "III.", "1.2.3"
 *   • ALL-CAPS short line: "ABSTRACT", "INTRODUCTION" (≤ 40 chars)
 *   • Title-case short line that matches a known section keyword
 *
 * Max heading length is kept tight to avoid matching long body sentences
 * that happen to start with a capital.
 */
const MAX_HEADING_LENGTH = 80;

const NUMBERED_HEADING_RE =
  /^(?:[IVXLCDM]+\.|(?:\d+\.)+\d*)\s+.{1,60}$/i;

const ALL_CAPS_HEADING_RE = /^[A-Z][A-Z\s\-&:]{2,39}$/;

// ─── Section keyword map ──────────────────────────────────────────────────────
// Maps lowercase normalised heading text → canonical SectionTitle.
// Longer / more specific strings are matched before shorter ones because
// we iterate in insertion order and return on first match.

const SECTION_KEYWORDS: Array<[RegExp, SectionTitle]> = [
  [/abstract/,                        "abstract"],
  [/introduction/,                    "introduction"],
  [/related\s+work|literature\s+review|prior\s+work|background\s+and\s+related/, "related_work"],
  [/background|preliminaries/,        "background"],
  [/method(?:ology)?|approach|proposed\s+method|our\s+approach|framework/, "methodology"],
  [/experiment|evaluation|setup|implementation\s+detail/, "experiments"],
  [/result|finding|performance|comparison|benchmark/, "results"],
  [/discussion|analysis|ablation/,    "discussion"],
  [/conclusion|summary/,              "conclusion"],
  [/future\s+work|limitation/,        "future_work"],
  [/acknowledge?ment/,                "acknowledgements"],
  [/reference|bibliography|works\s+cited/, "references"],
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Split a cleaned document into its constituent sections.
 *
 * Strategy:
 *   1. Walk lines looking for heading candidates.
 *   2. When a heading is found, close the previous section and open a new one.
 *   3. Anything before the first detected heading becomes an "other" preamble
 *      (title, authors, affiliations) — kept but labelled "other".
 *   4. Empty sections (heading with no body) are kept because downstream
 *      services may still want to know a section existed.
 */
export function detectSections(doc: CleanedDocument): SectionedDocument {
  const lines = doc.cleanText.split("\n");
  const sections: DocumentSection[] = [];

  let currentTitle: SectionTitle = "other";
  let currentRawHeading = "";
  let currentLines: string[] = [];
  let currentOffset = 0;
  let charOffset = 0;

  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (body.length > 0 || currentRawHeading.length > 0) {
      sections.push({
        title: currentTitle,
        rawHeading: currentRawHeading,
        body,
        startOffset: currentOffset,
      });
    }
  };

  for (const line of lines) {
    const detected = detectHeading(line);

    if (detected !== null) {
      flush();
      currentTitle = detected.sectionTitle;
      currentRawHeading = line.trim();
      currentLines = [];
      currentOffset = charOffset;
    } else {
      currentLines.push(line);
    }

    charOffset += line.length + 1; // +1 for the \n
  }

  // Flush the final section
  flush();

  const hasAbstract = sections.some((s) => s.title === "abstract");
  const hasMethodology = sections.some(
    (s) => s.title === "methodology" || s.title === "experiments"
  );

  return {
    ...doc,
    sections,
    hasAbstract,
    hasMethodology,
  };
}

// ─── Heading candidate detection ─────────────────────────────────────────────

interface DetectedHeading {
  sectionTitle: SectionTitle;
}

function detectHeading(line: string): DetectedHeading | null {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_HEADING_LENGTH) return null;

  // Must look like a heading structurally
  const isNumbered = NUMBERED_HEADING_RE.test(trimmed);
  const isAllCaps = ALL_CAPS_HEADING_RE.test(trimmed);

  if (!isNumbered && !isAllCaps) {
    // Last chance: short title-case line that matches a known keyword
    // (e.g. "Methodology" or "Related Work" without a number prefix)
    if (trimmed.split(" ").length > 6) return null;
    if (!/^[A-Z]/.test(trimmed)) return null;
  }

  const sectionTitle = classifyHeading(trimmed);
  return { sectionTitle };
}

function classifyHeading(heading: string): SectionTitle {
  const lower = heading.toLowerCase();
  for (const [pattern, title] of SECTION_KEYWORDS) {
    if (pattern.test(lower)) return title;
  }
  return "other";
}
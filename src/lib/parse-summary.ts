export interface ParsedSummarySubsection {
  heading: string;
  paragraphs: string[];
  items: string[];
}

export interface ParsedSummarySection {
  heading: string;
  paragraphs: string[];
  items: string[];
  subsections: ParsedSummarySubsection[];
}

export interface ParsedSummary {
  version: "legacy" | "v2";
  title: string | null;
  prose: string;
  keyPoints: string[];
  importantConcepts: string[];
  sections: ParsedSummarySection[];
}

const KEY_POINTS_MARKER = "\n\n**Key Points:**\n";
const CONCEPTS_MARKER = "\n\n**Important Concepts:** ";
const V2_MARKER_RE = /<!--\s*intelligence-engine:v2(?:\.\d+)?\s*-->/i;
const PAGE_ARTIFACT_RE =
  /^(?:(?:[-–—]{1,2}\s*)?(?:page\s*)?\d+(?:\s+(?:of|\/)\s+\d+)(?:\s*[-–—]{1,2})?)$/i;

export function parseSummary(value: string): ParsedSummary {
  if (V2_MARKER_RE.test(value) || /^##\s+/m.test(value)) {
    return parseStructuredSummary(value);
  }

  return parseLegacySummary(value);
}

function parseLegacySummary(flattened: string): ParsedSummary {
  const conceptsIdx = flattened.indexOf(CONCEPTS_MARKER);
  const keyPointsIdx = flattened.indexOf(KEY_POINTS_MARKER);
  const proseEnd =
    keyPointsIdx !== -1
      ? keyPointsIdx
      : conceptsIdx !== -1
        ? conceptsIdx
        : flattened.length;

  const prose = flattened.slice(0, proseEnd).trim();

  const keyPoints =
    keyPointsIdx === -1
      ? []
      : flattened
          .slice(
            keyPointsIdx + KEY_POINTS_MARKER.length,
            conceptsIdx !== -1 ? conceptsIdx : undefined,
          )
          .split("\n")
          .map((line) => cleanDisplayText(line.replace(/^-\s*/, "")))
          .filter(Boolean);

  const importantConcepts =
    conceptsIdx === -1
      ? []
      : flattened
          .slice(conceptsIdx + CONCEPTS_MARKER.length)
          .split(",")
          .map(cleanDisplayText)
          .filter(Boolean);

  return {
    version: "legacy",
    title: null,
    prose,
    keyPoints,
    importantConcepts,
    sections: [],
  };
}

function parseStructuredSummary(markdown: string): ParsedSummary {
  const lines = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\\([#*_`-])/g, "$1")
    .split(/\r?\n/);
  const sections: ParsedSummarySection[] = [];
  const preamble: string[] = [];
  let title: string | null = null;
  let currentSection: ParsedSummarySection | null = null;
  let currentSubsection: ParsedSummarySubsection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || isArtifact(line)) continue;

    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch) {
      title = cleanDisplayText(titleMatch[1]);
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      currentSection = {
        heading: cleanDisplayText(sectionMatch[1]),
        paragraphs: [],
        items: [],
        subsections: [],
      };
      sections.push(currentSection);
      currentSubsection = null;
      continue;
    }

    const subsectionMatch = line.match(/^###\s+(.+)$/);
    if (subsectionMatch && currentSection) {
      currentSubsection = {
        heading: cleanDisplayText(subsectionMatch[1]),
        paragraphs: [],
        items: [],
      };
      currentSection.subsections.push(currentSubsection);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const content = cleanDisplayText(bulletMatch?.[1] ?? line);

    if (!content || isArtifact(content)) continue;

    if (!currentSection) {
      preamble.push(content);
    } else if (currentSubsection) {
      (bulletMatch ? currentSubsection.items : currentSubsection.paragraphs).push(
        content,
      );
    } else {
      (bulletMatch ? currentSection.items : currentSection.paragraphs).push(
        content,
      );
    }
  }

  const overview = findSection(sections, "overview");
  const keyPoints = findSection(sections, "key points");
  const concepts = findSection(sections, "main concepts");
  const reserved = new Set(
    [overview, keyPoints, concepts].filter(
      (section): section is ParsedSummarySection => Boolean(section),
    ),
  );

  return {
    version: "v2",
    title,
    prose: [...preamble, ...(overview?.paragraphs ?? []), ...(overview?.items ?? [])]
      .join("\n\n")
      .trim(),
    keyPoints: unique(keyPoints?.items ?? []),
    importantConcepts: unique(concepts?.items ?? []),
    sections: sections.filter((section) => !reserved.has(section)),
  };
}

function findSection(
  sections: ParsedSummarySection[],
  heading: string,
): ParsedSummarySection | undefined {
  return sections.find(
    (section) => section.heading.toLowerCase() === heading,
  );
}

function cleanDisplayText(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(\(p{1,2}\.\s*\d+(?:-\d+)?\))_/gi, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([#*_`-])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isArtifact(value: string): boolean {
  const normalized = cleanDisplayText(value);

  return (
    !normalized ||
    V2_MARKER_RE.test(normalized) ||
    PAGE_ARTIFACT_RE.test(normalized) ||
    /^(?:svg\s*regenerate|regenerate\s+svg|generated\s+study\s+notes)$/i.test(
      normalized,
    )
  );
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

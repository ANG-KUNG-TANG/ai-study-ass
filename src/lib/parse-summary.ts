export interface ParsedSummaryListItem {
  text: string;
  children: string[];
}

export interface ParsedSummarySubsection {
  heading: string;
  paragraphs: string[];
  items: ParsedSummaryListItem[];
}

export interface ParsedSummarySection {
  heading: string;
  paragraphs: string[];
  items: ParsedSummaryListItem[];
  subsections: ParsedSummarySubsection[];
}

export interface ParsedSummaryTopic {
  heading: string;
  explanation: string;
  keyPoints: ParsedSummaryListItem[];
}

export interface ParsedSummary {
  version: "legacy" | "v2" | "v3";
  mode: SummaryMode;
  title: string | null;
  prose: string;
  overviewPoints: string[];
  keyPoints: string[];
  importantConcepts: string[];
  topics: ParsedSummaryTopic[];
  sections: ParsedSummarySection[];
}

const KEY_POINTS_MARKER = "\n\n**Key Points:**\n";
const CONCEPTS_MARKER = "\n\n**Important Concepts:** ";
const STRUCTURED_MARKER_RE =
  /<!--\s*intelligence-engine:(v2(?:\.\d+)?|v3(?:\.\d+)?)(?:;\s*mode:(concise|comprehensive|exam))?\s*-->/i;
const PAGE_ARTIFACT_RE =
  /^(?:(?:[-–—]{1,2}\s*)?(?:page\s*)?\d+(?:\s+(?:of|\/)\s+\d+)(?:\s*[-–—]{1,2})?)$/i;

export function parseSummary(value: string): ParsedSummary {
  if (STRUCTURED_MARKER_RE.test(value) || /^##\s+/m.test(value)) {
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
    mode: "comprehensive",
    title: null,
    prose,
    overviewPoints: prose ? [prose] : [],
    keyPoints,
    importantConcepts,
    topics: [],
    sections: [],
  };
}

function parseStructuredSummary(markdown: string): ParsedSummary {
  const marker = markdown.match(STRUCTURED_MARKER_RE);
  const markerMode = marker?.[2];
  const mode: SummaryMode = SUMMARY_MODES.includes(markerMode as SummaryMode)
    ? markerMode as SummaryMode
    : "comprehensive";
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
    const expandedLine = rawLine.replace(/\t/g, "  ");
    const line = expandedLine.trim();

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

    const bulletMatch = expandedLine.match(/^(\s*)[-*]\s+(.+)$/);
    const content = cleanDisplayText(bulletMatch?.[2] ?? line);

    if (!content || isArtifact(content)) continue;

    if (!currentSection) {
      preamble.push(content);
    } else if (currentSubsection) {
      if (bulletMatch) {
        addListItem(
          currentSubsection.items,
          content,
          bulletMatch[1].length,
        );
      } else {
        currentSubsection.paragraphs.push(content);
      }
    } else {
      if (bulletMatch) {
        addListItem(
          currentSection.items,
          content,
          bulletMatch[1].length,
        );
      } else {
        currentSection.paragraphs.push(content);
      }
    }
  }

  const overview = findSection(sections, "overview");
  const keyPoints = findSection(sections, "key points");
  const concepts = findSection(sections, "main concepts");
  const studyTopics = findSection(sections, "study topics");
  const overviewPoints = unique([
    ...(overview?.paragraphs ?? []),
    ...flattenListItems(overview?.items ?? []),
  ]);
  const topics = (studyTopics?.subsections ?? []).map((subsection) => ({
    heading: subsection.heading,
    explanation: extractTopicExplanation(subsection.paragraphs),
    keyPoints: subsection.items,
  }));
  const reserved = new Set(
    [overview, keyPoints, concepts, studyTopics].filter(
      (section): section is ParsedSummarySection => Boolean(section),
    ),
  );

  return {
    version: marker?.[1]?.toLocaleLowerCase().startsWith("v3") ? "v3" : "v2",
    mode,
    title,
    prose: [...preamble, ...overviewPoints]
      .join("\n\n")
      .trim(),
    overviewPoints,
    keyPoints: unique(flattenListItems(keyPoints?.items ?? [])),
    importantConcepts: unique(flattenListItems(concepts?.items ?? [])),
    topics,
    sections: sections.filter((section) => !reserved.has(section)),
  };
}

function extractTopicExplanation(paragraphs: string[]): string {
  const explicit = paragraphs.find((paragraph) =>
    /^simple explanation\s*:/iu.test(paragraph),
  );
  if (explicit) {
    return explicit.replace(/^simple explanation\s*:\s*/iu, "").trim();
  }

  return paragraphs.find((paragraph) =>
    !/^important key points\s*:?$/iu.test(paragraph),
  ) ?? "";
}

function addListItem(
  items: ParsedSummaryListItem[],
  text: string,
  indentation: number,
): void {
  if (indentation > 0 && items.length > 0) {
    items[items.length - 1].children.push(text);
    return;
  }

  items.push({ text, children: [] });
}

function flattenListItems(items: ParsedSummaryListItem[]): string[] {
  return items.flatMap((item) => [item.text, ...item.children]);
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
    STRUCTURED_MARKER_RE.test(normalized) ||
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
import {
  SUMMARY_MODES,
  type SummaryMode,
} from "@/types/summary";

export interface ParsedSummary {
  prose: string;
  keyPoints: string[];
  importantConcepts: string[];
}

const KEY_POINTS_MARKER = "\n\n**Key Points:**\n";
const CONCEPTS_MARKER = "\n\n**Important Concepts:** ";

export function parseSummary(flattened: string): ParsedSummary {
  const conceptsIdx = flattened.indexOf(CONCEPTS_MARKER);
  const keyPointsIdx = flattened.indexOf(KEY_POINTS_MARKER);
  const proseEnd = keyPointsIdx !== -1 ? keyPointsIdx : conceptsIdx !== -1 ? conceptsIdx : flattened.length;

  const prose = flattened.slice(0, proseEnd).trim();

  const keyPoints =
    keyPointsIdx === -1
      ? []
      : flattened
          .slice(keyPointsIdx + KEY_POINTS_MARKER.length, conceptsIdx !== -1 ? conceptsIdx : undefined)
          .split("\n")
          .map((l) => l.replace(/^-\s*/, "").trim())
          .filter(Boolean);

  const importantConcepts =
    conceptsIdx === -1
      ? []
      : flattened
          .slice(conceptsIdx + CONCEPTS_MARKER.length)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

  return { prose, keyPoints, importantConcepts };
}
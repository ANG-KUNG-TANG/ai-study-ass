import type { DocumentChunk, SectionedDocument } from "./types";

const DEFAULT_MAX_CHARS = 4600;
const DEFAULT_OVERLAP_SENTENCES = 2;

export interface ChunkOptions {
  maxChars?: number;
  overlapSentences?: number;
}

export function buildDocumentChunks(
  doc: SectionedDocument,
  options: ChunkOptions = {},
): DocumentChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapSentences = options.overlapSentences ?? DEFAULT_OVERLAP_SENTENCES;
  const chunks: DocumentChunk[] = [];

  for (const section of doc.sections) {
    if (section.semanticRole === "references" || !section.analysisBody.trim()) continue;

    const sentences = splitSentences(section.analysisBody);
    if (sentences.length === 0) continue;

    let cursor = 0;
    let part = 1;

    while (cursor < sentences.length) {
      const selected: string[] = [];
      let charCount = 0;
      let end = cursor;

      while (end < sentences.length) {
        const sentence = sentences[end];
        const nextLength = charCount + sentence.length + (selected.length > 0 ? 1 : 0);
        if (selected.length > 0 && nextLength > maxChars) break;
        selected.push(sentence);
        charCount = nextLength;
        end += 1;
      }

      const text = selected.join(" ").trim();
      chunks.push({
        id: `${section.id}-chunk-${part}`,
        sectionId: section.id,
        sectionTitle: section.rawHeading,
        semanticRole: section.semanticRole,
        text,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        tokenEstimate: Math.ceil(text.length / 4),
        overlapSentenceCount: cursor === 0 ? 0 : overlapSentences,
      });

      if (end >= sentences.length) break;
      cursor = Math.max(cursor + 1, end - overlapSentences);
      part += 1;
    }
  }

  return chunks;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20);
}

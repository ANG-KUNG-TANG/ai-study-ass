import type {
  CleanedDocument,
  DocumentSection,
  SectionedDocument,
  SectionTitle,
  SemanticSectionRole,
} from "./types";

interface HeadingCandidate {
  line: string;
  heading: string;
  number?: string;
  level: number;
  startOffset: number;
  lineEndOffset: number;
}

const HEADING_MAX_LENGTH = 110;

export function detectSections(doc: CleanedDocument): SectionedDocument {
  const candidates = findHeadingCandidates(doc.displayText);
  const sections: DocumentSection[] = [];

  if (candidates.length === 0) {
    sections.push({
      id: "section-document",
      title: "other",
      semanticRole: "other",
      rawHeading: "Document",
      level: 1,
      body: doc.displayText,
      analysisBody: doc.analysisText,
      startOffset: 0,
      endOffset: doc.displayText.length,
      ...estimatePages(doc, 0, doc.displayText.length),
    });
  } else {
    const first = candidates[0];
    if (first.startOffset > 0) {
      const preamble = doc.displayText.slice(0, first.startOffset).trim();
      if (preamble) {
        sections.push({
          id: "section-preamble",
          title: "other",
          semanticRole: "title",
          rawHeading: "Preamble",
          level: 1,
          body: preamble,
          analysisBody: stripCitationNoise(preamble),
          startOffset: 0,
          endOffset: first.startOffset,
          ...estimatePages(doc, 0, first.startOffset),
        });
      }
    }

    candidates.forEach((candidate, index) => {
      const next = candidates[index + 1];
      const bodyStart = candidate.lineEndOffset;
      const bodyEnd = next?.startOffset ?? doc.displayText.length;
      const body = doc.displayText.slice(bodyStart, bodyEnd).trim();
      const mapped = mapHeading(candidate.heading);
      const slug = slugify(`${candidate.number ?? ""}-${candidate.heading}`);

      sections.push({
        id: `section-${slug || index + 1}`,
        title: mapped.title,
        semanticRole: mapped.role,
        rawHeading: candidate.line.trim(),
        headingNumber: candidate.number,
        level: candidate.level,
        body,
        analysisBody: stripCitationNoise(body),
        startOffset: candidate.startOffset,
        endOffset: bodyEnd,
        ...estimatePages(doc, candidate.startOffset, bodyEnd),
      });
    });
  }

  return {
    ...doc,
    sections,
    hasAbstract: sections.some((section) => section.title === "abstract"),
    hasMethodology: sections.some((section) =>
      ["methodology", "experiments"].includes(section.title),
    ),
  };
}

function findHeadingCandidates(text: string): HeadingCandidate[] {
  const lines = text.split("\n");
  const candidates: HeadingCandidate[] = [];
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;

    if (!trimmed || trimmed.length > HEADING_MAX_LENGTH) continue;

    const numbered = trimmed.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/);
    if (numbered && looksLikeHeadingText(numbered[2])) {
      const level = numbered[1].split(".").length;
      candidates.push({
        line,
        heading: numbered[2].trim(),
        number: numbered[1],
        level,
        startOffset: lineStart,
        lineEndOffset: lineEnd + 1,
      });
      continue;
    }

    if (isKnownHeading(trimmed) || isUppercaseHeading(trimmed) || isTitleCaseHeading(trimmed)) {
      candidates.push({
        line,
        heading: trimmed,
        level: 1,
        startOffset: lineStart,
        lineEndOffset: lineEnd + 1,
      });
    }
  }

  return removeFalsePositiveHeadings(candidates, text);
}

function looksLikeHeadingText(value: string): boolean {
  const words = value.trim().split(/\s+/);
  if (words.length > 14) return false;
  if (/[.!?]$/.test(value) && words.length > 7) return false;
  return /[A-Za-z]/.test(value);
}

function isKnownHeading(value: string): boolean {
  return /^(abstract|introduction|background|related work|literature review|method(?:ology)?|materials and methods|approach|model|system design|implementation|experiment(?:s|al setup)?|evaluation|validation|results?|findings|discussion|limitations?|conclusions?|future work|acknowledg(?:e)?ments?|references|bibliography)$/i.test(
    value,
  );
}

function isUppercaseHeading(value: string): boolean {
  const letters = value.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3 && value === value.toUpperCase() && value.split(/\s+/).length <= 12;
}

function isTitleCaseHeading(value: string): boolean {
  const words = value.split(/\s+/);
  if (words.length < 1 || words.length > 10) return false;
  const titleWords = words.filter((word) => /^[A-Z][A-Za-z0-9&/-]*$/.test(word));
  return titleWords.length / words.length >= 0.75 && !/[.!?]$/.test(value);
}

function removeFalsePositiveHeadings(
  candidates: HeadingCandidate[],
  text: string,
): HeadingCandidate[] {
  return candidates.filter((candidate) => {
    const previous = text.slice(Math.max(0, candidate.startOffset - 2), candidate.startOffset);
    const next = text.slice(candidate.lineEndOffset, candidate.lineEndOffset + 200).trim();
    const words = candidate.heading.split(/\s+/);

    if (words.length > 12) return false;
    if (!next && candidate.heading.toLowerCase() !== "references") return false;
    if (previous && !previous.includes("\n") && candidate.startOffset > 0) return false;
    return true;
  });
}

function mapHeading(raw: string): { title: SectionTitle; role: SemanticSectionRole } {
  const value = raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (/abstract|executive summary/.test(value)) return { title: "abstract", role: "abstract" };
  if (/introduction|overview/.test(value)) return { title: "introduction", role: "background" };
  if (/related work|literature review|prior work/.test(value)) return { title: "related_work", role: "background" };
  if (/background|foundation|theory|bayesian network/.test(value)) return { title: "background", role: "background" };
  if (/method|approach|model|modelling|architecture|design/.test(value)) return { title: "methodology", role: "method" };
  if (/implementation|application methodology|toolset/.test(value)) return { title: "methodology", role: "implementation" };
  if (/experiment|evaluation|validation|trial|aim and methodology/.test(value)) return { title: "experiments", role: "evaluation" };
  if (/result|finding|performance/.test(value)) return { title: "results", role: "results" };
  if (/discussion|analysis|limitation/.test(value)) return { title: "discussion", role: "discussion" };
  if (/conclusion|summary/.test(value)) return { title: "conclusion", role: "conclusion" };
  if (/future work|future research/.test(value)) return { title: "future_work", role: "conclusion" };
  if (/acknowledg/.test(value)) return { title: "acknowledgements", role: "other" };
  if (/reference|bibliography/.test(value)) return { title: "references", role: "references" };
  return { title: "other", role: "other" };
}

function estimatePages(
  doc: CleanedDocument,
  startOffset: number,
  endOffset: number,
): { pageStart?: number; pageEnd?: number; pageEstimate: boolean } {
  if (doc.sourcePages.length > 1) {
    const startPage = doc.sourcePages.find(
      (page) => startOffset >= page.startOffset && startOffset <= page.endOffset,
    );
    const endPage = [...doc.sourcePages]
      .reverse()
      .find((page) => endOffset >= page.startOffset && endOffset <= page.endOffset);
    return {
      pageStart: startPage?.pageNumber,
      pageEnd: endPage?.pageNumber ?? startPage?.pageNumber,
      pageEstimate: false,
    };
  }

  const pageCount = doc.pageCount ?? 1;
  if (pageCount <= 1 || doc.displayText.length === 0) {
    return { pageStart: 1, pageEnd: 1, pageEstimate: pageCount > 1 };
  }

  const ratioStart = startOffset / doc.displayText.length;
  const ratioEnd = endOffset / doc.displayText.length;
  return {
    pageStart: Math.min(pageCount, Math.max(1, Math.floor(ratioStart * pageCount) + 1)),
    pageEnd: Math.min(pageCount, Math.max(1, Math.floor(ratioEnd * pageCount) + 1)),
    pageEstimate: true,
  };
}

function stripCitationNoise(text: string): string {
  return text
    .replace(/\[(?:\d+(?:\s*[,–-]\s*\d+)*)\]/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

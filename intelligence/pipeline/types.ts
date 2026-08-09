// src/server/intelligence/pipeline/types.ts

import type { DocumentKind } from "../types";

export interface RawDocumentPage {
  pageNumber: number;
  rawText: string;
}

export interface RawDocument {
  rawText: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number;
  /** Optional page-preserving input. The engine still works when omitted. */
  pages?: RawDocumentPage[];
}

export interface SourcePage {
  pageNumber: number;
  rawText: string;
  displayText: string;
  analysisText: string;
  startOffset: number;
  endOffset: number;
}

export interface CleanedDocument {
  sourceText: string;
  displayText: string;
  analysisText: string;
  /** Backwards-compatible alias for analysisText. */
  cleanText: string;
  sourcePages: SourcePage[];
  fileName: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number;
  cleaningStats: CleaningStats;
}

export interface CleaningStats {
  rawLength: number;
  cleanLength: number;
  pageNumbersRemoved: number;
  citationsRemoved: number;
  referenceLinesRemoved: number;
  referencesSectionTruncated: boolean;
  runningHeadersRemoved: number;
  hyphenatedBreaksJoined: number;
}

export type SectionTitle =
  | "abstract"
  | "introduction"
  | "related_work"
  | "background"
  | "methodology"
  | "experiments"
  | "results"
  | "discussion"
  | "conclusion"
  | "future_work"
  | "acknowledgements"
  | "references"
  | "objectives"
  | "requirements"
  | "process"
  | "diagram"
  | "appendix"
  | "metadata"
  | "other";

export type SemanticSectionRole =
  | "title"
  | "abstract"
  | "background"
  | "method"
  | "implementation"
  | "evaluation"
  | "results"
  | "discussion"
  | "conclusion"
  | "references"
  | "objectives"
  | "requirements"
  | "process"
  | "diagram"
  | "appendix"
  | "metadata"
  | "other";

export interface DocumentSection {
  id: string;
  title: SectionTitle;
  semanticRole: SemanticSectionRole;
  rawHeading: string;
  headingNumber?: string;
  level: number;
  body: string;
  analysisBody: string;
  startOffset: number;
  endOffset: number;
  pageStart?: number;
  pageEnd?: number;
  pageEstimate: boolean;
}

export interface SectionedDocument extends CleanedDocument {
  sections: DocumentSection[];
  hasAbstract: boolean;
  hasMethodology: boolean;
}

export interface DocumentChunk {
  id: string;
  sectionId: string;
  sectionTitle: string;
  semanticRole: SemanticSectionRole;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  tokenEstimate: number;
  overlapSentenceCount: number;
}

export interface ClassifiedDocument extends SectionedDocument {
  documentKind: DocumentKind;
}

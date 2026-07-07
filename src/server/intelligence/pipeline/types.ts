// ─── Document processing pipeline — shared types ─────────────────────────────
//
// These types flow through the pipeline in order:
//   RawDocument → CleanedDocument → SectionedDocument → KnowledgeCore
//
// Each stage receives the previous stage's output, so every type
// extends the one before it with the new data it adds.
//
// KnowledgeCore itself is NOT defined here — it lives in intelligence/type.ts
// since ontology resolution, graph building, and Prolog fact generation all
// depend on its exact shape. knowledge_extractor.ts imports it from "../type".

// ─── Stage 0: what the parser hands us ───────────────────────────────────────
export interface RawDocument {
  /** Raw text straight from pdf-parse or mammoth — unprocessed */
  rawText: string;
  /** Original filename, used for logging and the Note model */
  fileName: string;
  /** MIME type: application/pdf or application/vnd.openxmlformats… */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** Page count if available (PDF only) */
  pageCount?: number;
}

// ─── Stage 1: cleaner output ──────────────────────────────────────────────────
export interface CleanedDocument {
  /** Cleaned, normalised text ready for tokenisation */
  cleanText: string;
  /** Original file metadata carried forward */
  fileName: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number;
  /** Stats the cleaner collected — useful for logging and debugging */
  cleaningStats: CleaningStats;
}

export interface CleaningStats {
  /** Character count before cleaning */
  rawLength: number;
  /** Character count after cleaning */
  cleanLength: number;
  /** How many page-number lines were removed */
  pageNumbersRemoved: number;
  /** How many citation markers were stripped */
  citationsRemoved: number;
  /** How many reference-section lines were dropped */
  referenceLinesRemoved: number;
  /** Whether a references section was detected and truncated */
  referencesSectionTruncated: boolean;
}

// ─── Stage 2: section detector output ────────────────────────────────────────
export interface DocumentSection {
  /** Normalised section title, e.g. "abstract", "methodology" */
  title: SectionTitle;
  /** Raw heading text as it appeared in the document */
  rawHeading: string;
  /** Section body text, already cleaned */
  body: string;
  /** Character offset where this section starts in cleanText */
  startOffset: number;
}

/**
 * Well-known academic paper section titles.
 * The section detector maps headings to one of these values.
 * "other" catches anything not in the list.
 */
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
  | "other";

export interface SectionedDocument extends CleanedDocument {
  /** Ordered list of detected sections */
  sections: DocumentSection[];
  /** True if an abstract section was found — useful downstream */
  hasAbstract: boolean;
  /** True if a methodology / experiments section was found */
  hasMethodology: boolean;
}
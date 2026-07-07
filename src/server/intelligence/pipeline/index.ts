/**
 * Pipeline runner — the single entry point for document intelligence.
 *
 * Calling order:
 *   RawDocument
 *     → cleanDocument        (document_cleaner)
 *     → detectSections       (section_detector)
 *     → runNLPPipeline       (nlp_pipeline)
 *     → extractKnowledge     (knowledge_extractor)
 *     → { KnowledgeCore, NLPResult, SectionedDocument }
 *
 * The returned KnowledgeCore matches intelligence/type.ts exactly —
 * method, dataset, accuracy (number), problem, contributions[], keyPoints[],
 * entities[], plus an optional `extras` object for richer fields
 * (metric, limitations, futureWork, topic, keywords) that summary/chat
 * services may use but that ontology/graph/prolog never read.
 *
 * intelligence/engine.ts calls runPipeline() as its first phase, then
 * passes the resulting KnowledgeCore into ontology resolution and graph
 * building.
 */

import { cleanDocument } from "./document_cleaner";
import { detectSections } from "./section_detector";
import { runNLPPipeline } from "./nlp_pipeline";
import { extractKnowledge } from "./knowledge_extractor";

import type { RawDocument, SectionedDocument } from "./types";
import type { NLPResult } from "../types";
import type { KnowledgeCore } from "../types";

// ─── Output ───────────────────────────────────────────────────────────────────

export interface PipelineResult {
  /** Structured facts — passed into ontology resolution + graph building */
  knowledge: KnowledgeCore;
  /** Full NLP output — used by summary and chat services */
  nlp: NLPResult;
  /** Sectioned document — used by summary service for section-aware output */
  document: SectionedDocument;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export function runPipeline(raw: RawDocument): PipelineResult {
  const cleaned   = cleanDocument(raw);
  const sectioned = detectSections(cleaned);
  const nlp       = runNLPPipeline(sectioned);
  const knowledge = extractKnowledge(sectioned, nlp);

  return { knowledge, nlp, document: sectioned };
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type { RawDocument, SectionedDocument } from "./types";
export type { NLPResult, KnowledgeCore, KnowledgeExtras } from "../types";
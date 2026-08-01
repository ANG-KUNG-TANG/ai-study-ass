// =============================================================================
// server/intelligence/engine.ts
//
// The master orchestrator. Ties pipeline → ontology → graph → prolog →
// gap-detection → confidence into one IntelligenceResult. This is the only
// file feature services and note.service.ts should import to run
// intelligence processing — everything else in this folder is an
// implementation detail behind runPipeline().
//
// Sequence (straight line, no branching):
//   1. { knowledge, nlp, document } = pipeline.runPipeline(raw)
//        — this single call already chains clean → section → nlp → extract,
//          see pipeline/index.ts. We do NOT re-implement those four stages
//          here; we only orchestrate what comes after them.
//   2. ontology = ontologyCache.resolveAll(knowledge.entities)
//   3. graph    = buildGraph(knowledge, ontologyCache, noteId)
//   4. prolog   = new PrologEngine(); await prolog.load(graph, noteId)
//   4.5. prologAnswerCount = (await prolog.query('key_fact(NoteId, T, V)')).answers.length
//        — a lightweight "did the reasoning layer actually produce
//          anything" signal, feeding the confidence engine's prolog score.
//   5. gaps = detectKnowledgeGaps(knowledge, document, ontology)
//   6. confidenceBreakdown = computeConfidenceBreakdown({...})
//   7. if needsAIFallback(confidenceBreakdown.overall) and an aiGenerate
//      function was supplied: completeWithAI() fills the specific missing
//      fields, then graph/prolog/gaps/confidence are recomputed ONCE against
//      the merged core (not looped — this is a single hybrid pass, matching
//      the doc's "AI Hybrid (Optional)" framing, not an iterative retry).
//   8. return IntelligenceResult
//
// Failure handling: if any stage throws, the function does NOT swallow the
// error — it rethrows after attaching which stage failed, so the caller
// (note.service.ts) can log it and decide whether to retry, store a
// 'failed'-stage partial result, or surface an error to the user. We do not
// silently return a half-built IntelligenceResult; PipelineStage exists
// precisely so failure states are explicit, not inferred from missing fields.
//
// ON AI FALLBACK: per the project's existing "centralize thresholds"
// principle, the actual threshold decision lives in
// intelligence-result.entity.ts's needsAIFallback() — NOT hardcoded here.
// This file only calls that function and, if it returns true, hands off to
// fallback/ai_fallback.service.ts. engine.ts never imports a concrete AI
// provider module itself — the caller injects `aiGenerate` (see
// EngineInput below), keeping this file decoupled from provider choice,
// retry/backoff, and timeout logic, which stay in your real ai.service.ts.
// =============================================================================

import type {
  AIGenerateFn,
  IntelligenceResult,
  KnowledgeCore,
  KnowledgeGraph,
  NLPResult,
  PipelineStage,
  PrologFact,
  ResolvedConcept,
} from './types';
import { ontologyCache } from './ontology/ontology.cache';
import { buildGraph } from './graph/graph.engine';
import { PrologEngine, quoteAtom } from './prolog/prolog.engine';
import { detectGaps } from './pipeline/gap_detector';
import { computeConfidenceBreakdown } from './confidence/confidence.engine';
import { needsAIFallback } from '../entities/intelligence.entity';
import { completeWithAI } from './fallback/ai_fallback.service';

// ─── Document pipeline seam ──────────────────────────────────────────────────
// runPipeline() here is the EXISTING pipeline/index.ts function — it already
// chains cleanDocument → detectSections → runNLPPipeline → extractKnowledge
// internally and is synchronous. We import it under an alias so this file's
// own exported runPipeline() (the full intelligence orchestrator) doesn't
// collide with the document-pipeline's runPipeline() by name.
import { runPipeline as runDocumentPipeline } from './pipeline';
import type { RawDocument, PipelineResult, SectionedDocument } from './pipeline';

// ─── Engine entry input ──────────────────────────────────────────────────────
// This is what callers of THIS file's runPipeline() pass in — a raw document
// plus the noteId it belongs to. This is distinct from pipeline/types.ts's
// RawDocument, which has no noteId because the document pipeline doesn't
// need one; noteId only matters once we start building graph node ids and
// Prolog facts, which is this file's job, not the document pipeline's.

export interface EngineInput {
  noteId: string;
  document: RawDocument;
  /**
   * Optional AI generate function, injected by the caller (note.service.ts)
   * from your real ai.service.ts. If omitted and needsAIFallback() returns
   * true, the pipeline still completes — result.aiFallback.skippedReason
   * will explain that no AI adapter was supplied, and result.core keeps
   * whatever fields the symbolic pipeline managed to extract.
   */
  aiGenerate?: AIGenerateFn;
}

// ─── PipelineError ──────────────────────────────────────────────────────────
// Wraps the original error with which stage failed, so callers can branch on
// it (e.g. note.service.ts might retry a 'document' failure but not a
// 'prolog' one).

export class PipelineError extends Error {
  readonly stage: PipelineStage;
  readonly noteId: string;
  readonly cause: unknown;

  constructor(stage: PipelineStage, noteId: string, cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Pipeline failed at stage '${stage}' for note ${noteId}: ${causeMessage}`);
    this.name = 'PipelineError';
    this.stage = stage;
    this.noteId = noteId;
    this.cause = cause;
  }
}

// ─── Boot guard ───────────────────────────────────────────────────────────────
// ontologyCache.load() must run before resolveAll() works. Calling it here
// rather than requiring callers to remember a separate boot step keeps
// runPipeline() safe to call from any entry point — API routes, tests,
// scripts — without a hidden initialization order dependency leaking into
// note.service.ts.
//
// NOTE: ontologyCache.isLoaded() and ontologyCache.resolveAll() must exist
// on OntologyCache. If your current ontology.cache.ts only exposes
// resolve() (singular, one string at a time), either add resolveAll() as a
// thin wrapper:
//
//   resolveAll(raws: string[]): ResolvedConcept[] {
//     return raws.map((raw) => this.resolve(raw));
//   }
//
// or call ontologyCache.resolve() in a .map() at the call site below
// instead. This file assumes resolveAll() exists on the cache; swap to
// `knowledge.entities.map((e) => ontologyCache.resolve(e))` if it doesn't.

function ensureOntologyLoaded(): void {
  if (!ontologyCache.isLoaded()) {
    ontologyCache.load();
  }
}

function buildFallbackSource(document: SectionedDocument): string {
  const preferred = new Set([
    'abstract',
    'introduction',
    'methodology',
    'experiments',
    'results',
    'discussion',
    'conclusion',
  ]);
  const focused = document.sections
    .filter((section) => preferred.has(section.title))
    .map((section) => `${section.rawHeading || section.title}\n${section.body}`)
    .join('\n\n');
  return focused.trim().length > 0 ? focused : document.cleanText;
}

function resolveCoreOntology(core: KnowledgeCore): ResolvedConcept[] {
  const rawConcepts = [core.method, core.dataset, ...core.entities]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const seen = new Set<string>();
  const resolutions = ontologyCache.resolveAll(
    rawConcepts.filter((value) => {
      const key = value.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );

  if (core.problem?.trim()) {
    const problemResolution = ontologyCache.resolveFromText(core.problem);
    const duplicate = resolutions.some(
      (resolution) =>
        resolution.concept.id === problemResolution.concept.id &&
        resolution.matchType !== 'unknown',
    );
    if (!duplicate) resolutions.push(problemResolution);
  }

  return resolutions;
}

// ─── Symbolic stages (graph → prolog → gaps → confidence) ──────────────────────
// Extracted into a helper so Stage 7's hybrid re-run (after AI fills gaps)
// can call the exact same graph/prolog/gap/confidence logic against the
// merged core, instead of a second hand-maintained copy that could drift
// from the first pass.

interface SymbolicStagesResult {
  graph: KnowledgeGraph;
  prologEngine: PrologEngine;
  facts: PrologFact[];
  gaps: ReturnType<typeof detectGaps>;
  confidenceBreakdown: ReturnType<typeof computeConfidenceBreakdown>;
}

async function runSymbolicStages(
  core: KnowledgeCore,
  sectionedDoc: SectionedDocument,
  nlp: NLPResult,
  ontology: ResolvedConcept[],
  noteId: string,
): Promise<SymbolicStagesResult> {
  // ── Graph construction ─────────────────────────────────────────────────────
  let graph: KnowledgeGraph;
  try {
    graph = buildGraph(core, ontologyCache, noteId);
  } catch (err) {
    throw new PipelineError('graph', noteId, err);
  }

  // ── Prolog load ─────────────────────────────────────────────────────────────
  const prologEngine = new PrologEngine();
  let facts: PrologFact[];
  try {
    await prologEngine.load(graph, noteId);
    facts = prologEngine.getFacts();
  } catch (err) {
    throw new PipelineError('prolog', noteId, err);
  }

  // ── Prolog reasoning "success" signal ───────────────────────────────────────
  // key_fact(NoteId, Type, Val) is cs.rules.pl's single entry point for
  // quiz.service.ts, with up to 5 possible Type bindings (method, dataset,
  // accuracy, domain, task). How many of those actually fire for this note
  // is a direct measure of "did the reasoning layer produce anything",
  // feeding the confidence engine's prolog score. A failure here is
  // intentionally non-fatal — an empty/failed query just means
  // prologAnswerCount stays 0, which the confidence score already handles,
  // rather than failing the whole pipeline over a diagnostic query.
  let prologAnswerCount = 0;
  try {
    const keyFactResult = await prologEngine.query(`key_fact(${quoteAtom(noteId)}, Type, Val)`);
    prologAnswerCount = new Set(
      keyFactResult.answers.map((answer) => answer.bindings.Type).filter(Boolean),
    ).size;
  } catch {
    prologAnswerCount = 0;
  }

  // ── Knowledge Gap Detection ──────────────────────────────────────────────────
  let gaps;
  try {
    gaps = detectGaps(core, ontology, sectionedDoc.sections.map((s) => s.title));
  } catch (err) {
    throw new PipelineError('extraction', noteId, err);
  }

  // ── Confidence ───────────────────────────────────────────────────────────────
  const confidenceBreakdown = computeConfidenceBreakdown({
    nlp,
    ontology,
    graph,
    core,
    prologAnswerCount,
    gaps,
  });

  return { graph, prologEngine, facts, gaps, confidenceBreakdown };
}

// ─── runPipeline ───────────────────────────────────────────────────────────────

export async function runPipeline(input: EngineInput): Promise<IntelligenceResult> {
  const { noteId, document, aiGenerate } = input;

  ensureOntologyLoaded();

  // ── Stage 1: document pipeline (clean → section → nlp → extract) ───────────
  // This single call covers what the original draft tried to split into
  // separate 'nlp' and 'extraction' stages. pipeline/index.ts's runPipeline()
  // is synchronous and does all four steps internally — see that file for
  // the cleanDocument/detectSections/runNLPPipeline/extractKnowledge chain.
  //
  // FIX: nlp/knowledge were declared with `let nlp;` (no annotation), which
  // TypeScript infers as implicit `any`. Under noImplicitAny (or strict
  // mode) that's a compile error; without it, it silently defeats type
  // checking on the IntelligenceResult assembly below — either way it's
  // wrong. Explicitly typing both from PipelineResult fixes it.
  let nlp: NLPResult;
  let knowledge: KnowledgeCore;
  let sectionedDoc: SectionedDocument;
  try {
    const result: PipelineResult = runDocumentPipeline(document);
    nlp = result.nlp;
    knowledge = result.knowledge;
    sectionedDoc = result.document;
  } catch (err) {
    throw new PipelineError('extraction', noteId, err);
  }

  // ── Stage 2: Ontology resolution ────────────────────────────────────────────
  let ontology: ResolvedConcept[];
  try {
    ontology = resolveCoreOntology(knowledge);
  } catch (err) {
    throw new PipelineError('ontology', noteId, err);
  }

  // ── Stages 3-6: graph → prolog → gaps → confidence (first pass) ────────────
  let { graph, prologEngine, facts, gaps, confidenceBreakdown } = await runSymbolicStages(
    knowledge,
    sectionedDoc,
    nlp,
    ontology,
    noteId,
  );

  // ── Stage 7: High/Low branch — AI-Assisted Completion ───────────────────────
  // The doc's diagram: Confidence >= Threshold → Symbolic Features;
  // Confidence < Threshold → AI Hybrid. needsAIFallback() centralizes the
  // threshold (intelligence-result.entity.ts) — this file only acts on its
  // answer, it doesn't decide the number itself.
  //
  // This is a SINGLE hybrid pass, not a loop: if the AI fills some fields
  // but confidence is still below threshold afterward, we do not retry
  // again. The doc frames AI Hybrid as an optional one-shot enhancement,
  // not an iterative negotiation with the AI.
  let aiFallback: IntelligenceResult['aiFallback'] = {
    used: false,
    filledFields: [],
  };

  if (needsAIFallback(confidenceBreakdown.overall)) {
    if (!aiGenerate) {
      aiFallback = {
        used: false,
        filledFields: [],
        skippedReason: 'confidence below threshold but no aiGenerate function was supplied',
      };
    } else {
      try {
        const { core: mergedCore, result: fallbackResult } = await completeWithAI(
          knowledge,
          gaps,
          buildFallbackSource(sectionedDoc),
          aiGenerate,
        );
        aiFallback = fallbackResult;

        if (fallbackResult.used) {
          // Re-resolve ontology because AI may have supplied method/dataset values.
          knowledge = mergedCore;
          ontology = resolveCoreOntology(knowledge);
          ({ graph, prologEngine, facts, gaps, confidenceBreakdown } = await runSymbolicStages(
            knowledge,
            sectionedDoc,
            nlp,
            ontology,
            noteId,
          ));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        aiFallback = {
          used: false,
          filledFields: [],
          skippedReason: `AI fallback failed safely: ${message}`,
        };
      }
    }
  }

  // ── Stage 8: assembly ────────────────────────────────────────────────────────
  const result: IntelligenceResult = {
    noteId,
    stage: 'complete',
    nlp,
    core: knowledge,
    ontology,
    graph,
    prolog: {
      engine: prologEngine,
      facts,
    },
    gaps,
    confidenceBreakdown,
    confidence: confidenceBreakdown.overall,
    aiFallback,
    processedAt: new Date(),
  };

  return result;
}

// ─── Partial-failure result builder ──────────────────────────────────────────
// Used by note.service.ts when it wants to persist a 'failed' stage marker
// instead of letting the PipelineError propagate all the way to the API
// response. Not called automatically by runPipeline() — failure handling is
// the caller's decision, this just gives them a typed way to express it.

export function buildFailedResult(
  noteId: string,
  failedAtStage: PipelineStage,
  partial: Partial<IntelligenceResult> = {},
): Pick<IntelligenceResult, 'noteId' | 'stage' | 'processedAt'> & Partial<IntelligenceResult> {
  return {
    noteId,
    stage: failedAtStage,
    processedAt: new Date(),
    ...partial,
  };
}
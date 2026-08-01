// =============================================================================
// server/intelligence/confidence/confidence.engine.ts
//
// Confidence Evaluation Engine (doc component 6). Replaces the previous
// single-input computeOverallConfidence() in engine.ts, which was:
//
//   ontology.length === 0 ? 1.0 : Math.min(...ontology.map(r => r.confidence))
//
// — this only ever looked at ontology-resolution confidence. NLP quality,
// graph completeness, Prolog success, and section coverage never factored
// in at all. This module implements the doc's actual weighted formula:
//
//   NLP extraction               25%
//   Ontology mapping             20%
//   Knowledge graph completeness 20%
//   Prolog reasoning success     25%
//   Section coverage             10%
//
// Each sub-score is computed independently in [0, 1] and combined by
// computeConfidenceBreakdown() below. This module is pure and synchronous —
// it takes already-computed inputs (NLP result, ontology resolutions, the
// built graph, a Prolog "success" count, and the gap-detection coverage
// score) rather than reaching into the Prolog engine or re-running anything
// itself. Running the representative Prolog query that produces
// `prologAnswerCount` is engine.ts's job (Stage 4/5), since that's async and
// belongs to orchestration, not scoring.
//
// NOTE ON THE HIGH/LOW BRANCH: per the project's existing "centralize
// thresholds" principle (needsAIFallback() lives in the entity layer, not
// duplicated across services), this module deliberately does NOT decide a
// pass/fail threshold. It only produces the score; the High/Low fork into
// Symbolic Features vs AI-Assisted Completion belongs downstream, wherever
// needsAIFallback() is centralized.
// =============================================================================

import type {
  ConfidenceBreakdown,
  KnowledgeCore,
  KnowledgeGap,
  KnowledgeGraph,
  NLPResult,
  ResolvedConcept,
} from '../types';

// ─── Weights ───────────────────────────────────────────────────────────────────
// Must sum to 1.0 — enforced by a dev-time assertion below rather than just
// a comment, so a future edit that changes one weight without the others
// fails loudly instead of silently producing a confidence score that isn't
// actually normalised to [0, 1].

const WEIGHTS = {
  nlp: 0.25,
  ontology: 0.20,
  graph: 0.20,
  prolog: 0.25,
  coverage: 0.10,
} as const;

const WEIGHT_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1.0) > 1e-9) {
  throw new Error(
    `confidence.engine.ts: WEIGHTS must sum to 1.0, got ${WEIGHT_SUM}. ` +
      'Fix the weights before this module can be trusted.',
  );
}

// ─── 1. NLP extraction score ────────────────────────────────────────────────────
// Measures whether the NLP stage actually found usable signal, not just
// whether it ran. Three independent indicators, each capped at 1 so a
// document with an unusually large entity/keyword count doesn't skew the
// average past what "fully confident" should mean:
//   - entities found (capped at 3 — a paper with 3+ recognised entities is
//     as confident on this axis as one with 30)
//   - keywords extracted (capped at 5)
//   - at least one top-ranked sentence produced (binary — either TextRank
//     produced usable summary sentences or it didn't)

function scoreNLP(nlp: NLPResult): number {
  const entityScore = Math.min(1, nlp.entities.length / 3);
  const keywordScore = Math.min(1, nlp.keywords.length / 5);
  const sentenceScore = nlp.topSentences.length > 0 ? 1 : 0;
  return (entityScore + keywordScore + sentenceScore) / 3;
}

// ─── 2. Ontology mapping score ──────────────────────────────────────────────────
// Average resolution confidence across every entity the pipeline tried to
// place in the ontology. Deliberately an average, not the old min() — under
// the weighted formula this is one input among five, not a standalone gate,
// so one weak match shouldn't drag this component to its floor the way it
// used to drag the *entire* confidence score to its floor.
//
// Edge case: no entities to resolve means this stage produced no positive
// evidence, so it contributes 0 rather than artificially increasing the
// overall confidence.

function scoreOntology(ontology: ResolvedConcept[]): number {
  if (ontology.length === 0) return 0.0;
  const sum = ontology.reduce((acc, r) => acc + r.confidence, 0);
  return sum / ontology.length;
}

// ─── 3. Knowledge graph completeness score ──────────────────────────────────────
// Of the KnowledgeCore fields that were actually extracted (non-null),
// how many made it into the graph as a real node? A field can be non-null
// but still fail to produce a node if it resolved to 'unknown' (see
// graph.engine.ts's unknown-match guard) — that's exactly the gap this
// score is meant to surface: extraction succeeded, but the ontology
// couldn't place it, so the graph is less complete than the raw KnowledgeCore
// fields alone would suggest.
//
// Edge case: no fields extracted means the graph carries no structured
// knowledge beyond the paper node, so this component contributes 0.

function scoreGraph(graph: KnowledgeGraph, core: KnowledgeCore): number {
  const checks: Array<{ expected: boolean; nodePrefix: string }> = [
    { expected: core.method !== null, nodePrefix: 'method:' },
    { expected: core.dataset !== null, nodePrefix: 'dataset:' },
    { expected: core.accuracy !== null, nodePrefix: 'metric:' },
    { expected: core.problem !== null, nodePrefix: 'task:' },
  ];

  const expectedChecks = checks.filter((c) => c.expected);
  if (expectedChecks.length === 0) return 0.0;

  const nodeIds = [...graph.nodes.keys()];
  const foundCount = expectedChecks.filter((c) =>
    nodeIds.some((id) => id.startsWith(c.nodePrefix)),
  ).length;

  return foundCount / expectedChecks.length;
}

// ─── 4. Prolog reasoning success score ──────────────────────────────────────────
// `answerCount` is the number of distinct key_fact/3 solutions the engine
// found when it queried key_fact(NoteId, Type, Val) after loading (see
// engine.ts Stage 4.5). cs.rules.pl's key_fact/3 has 5 possible Type
// bindings (method, dataset, accuracy, domain, task) — the more of those
// that successfully fire, the more the Prolog layer actually contributed
// beyond just restating the raw facts it was given.

const MAX_KEY_FACT_TYPES = 5;

function scoreProlog(answerCount: number): number {
  return Math.min(1, answerCount / MAX_KEY_FACT_TYPES);
}

// ─── 5. Section coverage score ──────────────────────────────────────────────────
// Delegates directly to Knowledge Gap Detection's coverageScore — no need
// to recompute it here, gap_detector.ts already produces exactly this
// number from missingFields + missingSections.

function scoreCoverage(gaps: KnowledgeGap): number {
  return gaps.coverageScore;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ConfidenceInputs {
  nlp: NLPResult;
  ontology: ResolvedConcept[];
  graph: KnowledgeGraph;
  core: KnowledgeCore;
  /** Number of distinct key_fact/3 solutions found — see engine.ts */
  prologAnswerCount: number;
  gaps: KnowledgeGap;
}

export function computeConfidenceBreakdown(inputs: ConfidenceInputs): ConfidenceBreakdown {
  const nlp = scoreNLP(inputs.nlp);
  const ontology = scoreOntology(inputs.ontology);
  const graph = scoreGraph(inputs.graph, inputs.core);
  const prolog = scoreProlog(inputs.prologAnswerCount);
  const coverage = scoreCoverage(inputs.gaps);

  const overall =
    nlp * WEIGHTS.nlp +
    ontology * WEIGHTS.ontology +
    graph * WEIGHTS.graph +
    prolog * WEIGHTS.prolog +
    coverage * WEIGHTS.coverage;

  return {
    nlp,
    ontology,
    graph,
    prolog,
    coverage,
    overall,
    overallOutOf10: overall * 10,
  };
}

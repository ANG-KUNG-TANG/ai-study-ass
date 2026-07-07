// =============================================================================
// server/intelligence/prolog/explanation.ts
//
// Converts a PrologAnswer's evidence (raw PrologFact[]) into the
// human-readable `explanation: string` that PrologResult carries.
//
// This file is called from exactly one place: prolog.engine.ts, at the end
// of query()/queryAll(), once tau-prolog has produced PrologAnswer[]. It has
// no knowledge of tau-prolog itself — it only ever sees the already-resolved
// PrologFact[] evidence array, which keeps it trivially unit-testable without
// a live Prolog session.
//
// Design principle: every fact has a known functor (method, dataset,
// accuracy, is_a, part_of, uses, solves, related_to, achieves, trained_on,
// belongs_to, high_accuracy, etc — see cs.rules.pl). Each functor maps to one
// sentence template. Unknown functors fall back to a generic
// "functor(args)" rendering rather than throwing, so a new rule added to
// cs.rules.pl without a matching template here degrades gracefully instead
// of crashing the explanation layer.
// =============================================================================

import type { OntologyDomain, PrologAnswer, PrologFact } from '../types';
import { ontologyCache } from '../ontology/ontology.cache';

// ─── Label lookup ──────────────────────────────────────────────────────────────
// Facts store raw conceptIds ('cnn', 'deep_learning') as args — never the
// human label ('Convolutional Neural Network'). This is the one seam where
// explanation.ts reaches into OntologyCache: to turn an id back into
// something readable. Falls back to the raw id itself if the cache has no
// entry for it (e.g. a noteId, or an 'unknown:' sentinel concept).

function label(id: string): string {
  const concept = ontologyCache.isLoaded() ? ontologyCache.getById(id) : undefined;
  return concept?.label ?? id;
}

function domainLabel(domain: string): string {
  // Domain values are already human-readable enough ('computer_vision' →
  // 'Computer Vision') with simple underscore-to-space + title-case —
  // no ontology lookup needed since OntologyDomain is a closed string union,
  // not a concept id.
  return domain
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Fact → sentence templates ─────────────────────────────────────────────────
// One entry per functor. Each template receives the fact's args in order
// (matching the arg order used when the fact was generated — see
// graph.engine.ts and prolog.engine.ts's fact-loading stage) and returns one
// readable clause. These are deliberately terse — they get chained together
// by orderEvidenceChain(), so each one should read naturally mid-sentence.

type SentenceTemplate = (args: string[]) => string;

const TEMPLATES: Record<string, SentenceTemplate> = {
  // ── Direct facts (paper-level) ────────────────────────────────────────────
  method: ([, conceptId]) => `the paper uses ${label(conceptId)}`,
  dataset: ([, conceptId]) => `the paper is trained on ${label(conceptId)}`,
  accuracy: ([, value]) => `the paper reports ${value}% accuracy`,
  problem: ([, conceptId]) => `the paper addresses ${label(conceptId)}`,
  // FIX (audit #5): new functor for the renamed paper→concept edge (was
  // related_to, now mentions — see graph.engine.ts). Paper-level, so this
  // reads naturally alongside method/dataset/problem above.
  mentions: ([, conceptId]) => `the paper also mentions ${label(conceptId)}`,

  // ── Ontology-derived edges ────────────────────────────────────────────────
  is_a: ([from, to]) => `${label(from)} is a type of ${label(to)}`,
  part_of: ([from, to]) => `${label(from)} is part of ${label(to)}`,
  uses: ([from, to]) => `${label(from)} uses ${label(to)}`,
  solves: ([from, to]) => `${label(from)} solves ${label(to)}`,
  // FIX (audit #5): new functor for the renamed concept-to-concept 'solves'
  // ontology relation (was plain 'solves', now 'concept_solves' — see
  // prolog.engine.ts's PAPER_LEVEL_FUNCTORS rename). Same wording as the
  // paper-level template above; only the functor differs.
  concept_solves: ([from, to]) => `${label(from)} solves ${label(to)}`,
  related_to: ([from, to]) => `${label(from)} is related to ${label(to)}`,
  achieves: ([, value]) => `achieves a score of ${value}`,
  trained_on: ([from, to]) => `${label(from)} is trained on ${label(to)}`,

  // ── Derived/inferred facts (from cs.rules.pl) ─────────────────────────────
  belongs_to: ([conceptId, domain]) =>
    `${label(conceptId)} belongs to the ${domainLabel(domain)} domain`,
  high_accuracy: () => `this counts as a high-accuracy result (above 95%)`,
  moderate_accuracy: () => `this counts as a moderate-accuracy result (80–95%)`,
  low_accuracy: () => `this counts as a low-accuracy result (below 80%)`,
  computer_vision_paper: () => `the paper is classified under Computer Vision`,
  nlp_paper: () => `the paper is classified under NLP`,
  ml_paper: () => `the paper is classified under Machine Learning`,
  outperforms: () => `this paper outperforms the comparison paper`,
  same_domain: () => `both papers fall under the same domain`,
  same_dataset: () => `both papers use the same dataset`,
  recommended_baseline: ([, baseline]) => `${label(baseline)} is a related baseline worth comparing against`,
  key_fact: ([, fieldType, value]) => `${fieldType}: ${value}`,
};

/**
 * Render one PrologFact as a readable clause.
 * Unknown functors degrade to a generic rendering rather than throwing —
 * a new Prolog rule added without a matching template here should still
 * produce *something* readable, not break the explanation pipeline.
 */
function factToSentence(fact: PrologFact): string {
  const template = TEMPLATES[fact.functor];
  if (template) {
    try {
      return template(fact.args);
    } catch {
      // Template assumed an arg shape the fact didn't have — fall through
      // to the generic rendering below rather than propagating.
    }
  }
  return `${fact.functor}(${fact.args.join(', ')})`;
}

// ─── Evidence ordering ──────────────────────────────────────────────────────────
// Direct facts (method, dataset, accuracy, problem) describe the paper
// itself and read most naturally first. Ontology edges (is_a, part_of, …)
// describe *why* — they read naturally as a chain after the direct facts.
// Derived facts (belongs_to, high_accuracy, …) are the conclusion and
// should come last, since they're what the chain is building toward.
//
// Within each tier, evidence is deduplicated — the same fact can appear
// more than once across PrologAnswer.evidence when multiple rules in
// cs.rules.pl independently reference it (e.g. both belongs_to/2 and
// computer_vision_paper/1 may both cite the same is_a fact).

const DIRECT_FUNCTORS = new Set(['method', 'dataset', 'accuracy', 'problem', 'mentions']);
const ONTOLOGY_FUNCTORS = new Set([
  'is_a', 'part_of', 'uses', 'solves', 'concept_solves', 'related_to', 'achieves', 'trained_on',
]);
// Everything not in the two sets above (belongs_to, high_accuracy,
// computer_vision_paper, outperforms, etc.) is treated as a derived/
// conclusion-tier fact and sorted last.

function factKey(fact: PrologFact): string {
  return `${fact.functor}(${fact.args.join(',')})`;
}

function orderEvidenceChain(evidence: PrologFact[]): PrologFact[] {
  const seen = new Set<string>();
  const deduped = evidence.filter((fact) => {
    // The bare paper(noteId) fact is uninformative in an explanation chain —
    // every other fact already implies the paper exists — and previously had
    // no template, leaking through as a raw "Paper(507f...)." fallback line.
    if (fact.functor === 'paper') return false;
    const key = factKey(fact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const direct = deduped.filter((f) => DIRECT_FUNCTORS.has(f.functor));
  const ontology = deduped.filter((f) => ONTOLOGY_FUNCTORS.has(f.functor));
  const derived = deduped.filter(
    (f) => !DIRECT_FUNCTORS.has(f.functor) && !ONTOLOGY_FUNCTORS.has(f.functor),
  );

  return [...direct, ...ontology, ...derived];
}

// ─── Sentence joining ────────────────────────────────────────────────────────────
// Direct facts read naturally separated by periods — they're independent
// statements about the paper. Ontology and derived facts read naturally
// chained with "→" since they represent a reasoning path, not a list of
// unrelated observations. This mirrors the example in types.ts's
// PrologResult.explanation doc comment:
//   'CNN is_a DeepLearning (from ontology) → paper belongs to DeepLearning domain'

function joinSentences(ordered: PrologFact[]): string {
  if (ordered.length === 0) return 'No supporting evidence was found.';

  const direct = ordered.filter((f) => DIRECT_FUNCTORS.has(f.functor));
  const reasoning = ordered.filter((f) => !DIRECT_FUNCTORS.has(f.functor));

  const directText = direct
    .map((f) => capitalise(factToSentence(f)))
    .join('. ');

  const reasoningText = reasoning.map((f) => factToSentence(f)).join(' → ');

  if (directText && reasoningText) {
    return `${directText}. ${capitalise(reasoningText)}.`;
  }
  if (directText) {
    return `${directText}.`;
  }
  return `${capitalise(reasoningText)}.`;
}

function capitalise(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * Build the explanation string for a single PrologAnswer.
 * Called once per answer inside prolog.engine.ts's query() — the engine
 * is responsible for picking which answer's explanation becomes the
 * PrologResult-level `explanation` field (typically the first/best answer
 * when there are multiple solutions via backtracking).
 */
export function explainAnswer(answer: PrologAnswer): string {
  const ordered = orderEvidenceChain(answer.evidence);
  return joinSentences(ordered);
}

/**
 * Build a combined explanation across all answers to a query — used when
 * a goal has multiple solutions and the caller wants every reasoning path
 * surfaced (e.g. quiz explanation listing all matching facts) rather than
 * just the first one. Each answer's explanation is numbered for clarity
 * when there's more than one.
 */
export function explainAllAnswers(answers: PrologAnswer[]): string {
  if (answers.length === 0) {
    return 'No answers were found for this query.';
  }
  if (answers.length === 1) {
    return explainAnswer(answers[0]);
  }
  return answers
    .map((answer, i) => `(${i + 1}) ${explainAnswer(answer)}`)
    .join(' ');
}

/**
 * Render evidence as a flat list of fact strings — used by ChatResult.evidence
 * and shown to the user as "Sources" in the chat UI. This is the raw
 * 'method(noteAbc, cnn)' form, not the readable sentence form — sources
 * should look like citations, not prose.
 */
export function evidenceToFactStrings(evidence: PrologFact[]): string[] {
  return orderEvidenceChain(evidence).map(
    (f) => `${f.functor}(${f.args.join(', ')})`,
  );
}
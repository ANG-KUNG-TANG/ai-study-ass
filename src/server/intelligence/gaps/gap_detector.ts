// =============================================================================
// server/intelligence/gaps/gap_detector.ts
//
// Knowledge Gap Detection (doc component 4) — previously unimplemented. No
// file anywhere computed "expected vs extracted" coverage or produced a
// `missing: [...]` output; this module fills that gap.
//
// Workflow (matches the doc exactly):
//   Ontology → Expected Concepts → Extracted Concepts → Compare →
//   Missing Concepts → Knowledge Gap
//
// Two independent comparisons feed into one coverage score:
//   1. Expected KnowledgeCore fields (method, dataset, accuracy, problem)
//      vs which of them actually resolved to a non-null value.
//   2. Expected paper sections (abstract, methodology, experiments,
//      results, conclusion) vs which sections detect_sections.ts actually
//      found (SectionedDocument.sections[].title, or hasAbstract/
//      hasMethodology as shortcuts for two of them).
//
// This is deliberately a structural/coverage check, not a semantic one —
// it answers "did the paper *have* a Results section", not "is the Results
// section any good". That keeps it fast, deterministic, and dependency-free,
// consistent with the rest of the symbolic pipeline (no AI call needed to
// produce this signal — it's exactly the kind of thing the doc's "Ontology
// comparison, rule-based validation" description implies).
// =============================================================================

import type {
  ExpectedField,
  ExpectedSection,
  KnowledgeCore,
  KnowledgeGap,
  ResolvedConcept,
} from '../types';
import type { SectionedDocument } from '../pipeline/types';

// ─── Expected sets ─────────────────────────────────────────────────────────────

const EXPECTED_FIELDS: ExpectedField[] = ['method', 'dataset', 'accuracy', 'problem'];

const EXPECTED_SECTIONS: ExpectedSection[] = [
  'abstract',
  'methodology',
  'experiments',
  'results',
  'conclusion',
];

// ─── Field coverage ────────────────────────────────────────────────────────────

function findMissingFields(core: KnowledgeCore): ExpectedField[] {
  const missing: ExpectedField[] = [];
  if (core.method === null) missing.push('method');
  if (core.dataset === null) missing.push('dataset');
  if (core.accuracy === null) missing.push('accuracy');
  if (core.problem === null) missing.push('problem');
  return missing;
}

// ─── Section coverage ──────────────────────────────────────────────────────────

function findMissingSections(doc: SectionedDocument): ExpectedSection[] {
  const present = new Set(doc.sections.map((s) => s.title));
  return EXPECTED_SECTIONS.filter((title) => !present.has(title));
}

// ─── Unresolved entities ───────────────────────────────────────────────────────
// Entities the NLP layer found but the ontology couldn't place anywhere —
// these are a softer signal than missing fields/sections (the paper *does*
// discuss something), but they flag concepts the ontology doesn't yet cover,
// which is useful for growing cs_ontology.ts over time.

function findUnresolvedEntities(ontology: ResolvedConcept[]): string[] {
  return ontology
    .filter((r) => r.matchType === 'unknown')
    .map((r) => r.rawInput);
}

// ─── Coverage score ────────────────────────────────────────────────────────────
// Combines field coverage and section coverage into one [0, 1] number.
// Weighted evenly between the two categories (not per-item) so that a
// paper with many sections but no method isn't penalised less than one
// with few sections — "did we get the core facts" and "does the paper
// have expected structure" are treated as equally important signals.

function computeCoverageScore(
  missingFields: ExpectedField[],
  missingSections: ExpectedSection[],
): number {
  const fieldCoverage = 1 - missingFields.length / EXPECTED_FIELDS.length;
  const sectionCoverage = 1 - missingSections.length / EXPECTED_SECTIONS.length;
  return (fieldCoverage + sectionCoverage) / 2;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function detectKnowledgeGaps(
  core: KnowledgeCore,
  doc: SectionedDocument,
  ontology: ResolvedConcept[],
): KnowledgeGap {
  const missingFields = findMissingFields(core);
  const missingSections = findMissingSections(doc);
  const unresolvedEntities = findUnresolvedEntities(ontology);
  const coverageScore = computeCoverageScore(missingFields, missingSections);

  return {
    missingFields,
    missingSections,
    unresolvedEntities,
    coverageScore,
  };
}

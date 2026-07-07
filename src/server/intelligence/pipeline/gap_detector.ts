// =============================================================================
// server/intelligence/pipeline/gap_detector.ts
//
// Knowledge Gap Detection — merged from two previously-separate
// implementations (gaps/gap_detector.ts and pipeline/gap_detector.ts) that
// had drifted into incompatible shapes. This is now the single source of
// truth; gaps/gap_detector.ts should be deleted once this is confirmed to
// be the version engine.ts / intelligence.entity.ts actually consume.
//
// Combines:
//   - Structural checks (missing core fields, missing sections) — from the
//     pipeline/ version, kept as GapDetectionResult's existing shape so
//     nothing downstream (intelligence.entity.ts, persistence) breaks.
//   - Domain gap checks via ontology concept relations — from the pipeline/
//     version (e.g. "used CNN but never mentioned backpropagation").
//   - Unresolved entities — from the gaps/ version: NLP-detected entities
//     the ontology couldn't place at all. Softer signal than a missing
//     field; useful for growing cs_ontology.ts over time.
//   - Coverage score — from the gaps/ version: a single [0,1] number,
//     weighted evenly between field coverage and section coverage, so a
//     paper with many sections but no method isn't penalised less than one
//     with few sections but a clear method.
// =============================================================================

import type { KnowledgeCore, ResolvedConcept, GapDetectionResult } from "../types";
import { ontologyCache } from "../ontology/ontology.cache";

const EXPECTED_FIELDS = ["method", "dataset", "accuracy", "problem"] as const;
const EXPECTED_SECTIONS = [
  "abstract",
  "introduction",
  "methodology",
  "experiments",
  "results",
  "discussion",
  "conclusion",
] as const;

/**
 * Detect gaps in the extracted document representation by comparing it to
 * expectations from structural requirements, the domain ontology, and
 * unresolved NLP entities. `sections` is the list of section titles actually
 * detected in the document (e.g. doc.sections.map(s => s.title)).
 */
export function detectGaps(
  core: KnowledgeCore,
  ontology: ResolvedConcept[],
  sections: string[]
): GapDetectionResult {
  const structuralGaps: string[] = [];
  const domainGaps: string[] = [];
  const missingSections: Array<(typeof EXPECTED_SECTIONS)[number]> = [];

  // ── 1. Structural checks ──────────────────────────────────────────────────
  if (!core.method) structuralGaps.push("Method/Algorithm");
  if (!core.dataset) structuralGaps.push("Dataset");
  if (core.accuracy === null) structuralGaps.push("Evaluation Metric/Accuracy");
  if (!core.problem) structuralGaps.push("Problem Statement");
  if (!core.extras?.limitations) structuralGaps.push("Limitations");
  if (!core.extras?.futureWork) structuralGaps.push("Future Work");

  // ── 2. Section checks ─────────────────────────────────────────────────────
  const lowerSections = sections.map((s) => s.toLowerCase());
  for (const exp of EXPECTED_SECTIONS) {
    if (!lowerSections.some((s) => s.includes(exp) || exp.includes(s))) {
      missingSections.push(exp);
    }
  }

  // ── 3. Domain ontology gap check ──────────────────────────────────────────
  const resolvedIds = new Set(
    ontology.filter((r) => r.matchType !== "unknown").map((r) => r.concept.id)
  );

  const keyConcepts = ontology
    .filter(
      (r) =>
        r.matchType !== "unknown" &&
        (r.concept.id === core.method || r.concept.id === core.dataset)
    )
    .map((r) => r.concept);

  for (const concept of keyConcepts) {
    for (const rel of concept.relations) {
      if (!resolvedIds.has(rel.target)) {
        const targetConcept = ontologyCache.getById(rel.target);
        if (targetConcept && !domainGaps.includes(targetConcept.label)) {
          domainGaps.push(targetConcept.label);
        }
      }
    }
  }

  // ── 4. Unresolved entities ────────────────────────────────────────────────
  // Entities the NLP layer found but the ontology couldn't place anywhere.
  // Softer signal than missingFields/missingSections — the paper *does*
  // discuss something, but it's a concept cs_ontology.ts doesn't cover yet.
  const unresolvedEntities = ontology
    .filter((r) => r.matchType === "unknown")
    .map((r) => r.rawInput);

  // ── 5. Coverage score ──────────────────────────────────────────────────────
  // [0,1], weighted evenly between field coverage and section coverage —
  // not per-item — so a paper with many sections but no method isn't
  // penalised less than one with few sections but a clear method.
  const fieldCoverage = 1 - structuralGaps.length / (EXPECTED_FIELDS.length + 2); // +2 for limitations/futureWork
  const sectionCoverage = 1 - missingSections.length / EXPECTED_SECTIONS.length;
  const coverageScore = (fieldCoverage + sectionCoverage) / 2;

  return {
    structuralGaps,
    domainGaps: domainGaps.slice(0, 5),
    missingSections,
    unresolvedEntities,
    coverageScore,
  };
}
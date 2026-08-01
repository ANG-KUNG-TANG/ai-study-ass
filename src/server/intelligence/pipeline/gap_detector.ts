// =============================================================================
// Canonical knowledge-gap detector.
// =============================================================================

import type {
  ExpectedField,
  ExpectedSection,
  GapDetectionResult,
  KnowledgeCore,
  ResolvedConcept,
} from "../types";
import { ontologyCache } from "../ontology/ontology.cache";

const EXPECTED_FIELDS: ExpectedField[] = ["method", "dataset", "accuracy", "problem"];
const EXPECTED_SECTIONS: ExpectedSection[] = [
  "abstract",
  "methodology",
  "experiments",
  "results",
  "conclusion",
];

const FIELD_LABELS: Record<ExpectedField, string> = {
  method: "Method/Algorithm",
  dataset: "Dataset",
  accuracy: "Evaluation Metric/Accuracy",
  problem: "Problem Statement",
};

function findMissingFields(core: KnowledgeCore): ExpectedField[] {
  const missing: ExpectedField[] = [];
  if (!core.method?.trim()) missing.push("method");
  if (!core.dataset?.trim()) missing.push("dataset");
  if (core.accuracy === null) missing.push("accuracy");
  if (!core.problem?.trim()) missing.push("problem");
  return missing;
}

export function detectGaps(
  core: KnowledgeCore,
  ontology: ResolvedConcept[],
  sections: string[],
): GapDetectionResult {
  const missingFields = findMissingFields(core);
  const structuralGaps = missingFields.map((field) => FIELD_LABELS[field]);

  const presentSections = sections.map((section) => section.toLowerCase().trim());
  const missingSections = EXPECTED_SECTIONS.filter(
    (expected) => !presentSections.some((actual) => actual === expected),
  );

  const resolvedIds = new Set(
    ontology
      .filter((resolution) => resolution.matchType !== "unknown")
      .map((resolution) => resolution.concept.id),
  );

  const primaryIds = new Set(
    ontology
      .filter(
        (resolution) =>
          resolution.matchType !== "unknown" &&
          (resolution.rawInput.toLowerCase() === core.method?.toLowerCase() ||
            resolution.rawInput.toLowerCase() === core.dataset?.toLowerCase()),
      )
      .map((resolution) => resolution.concept.id),
  );

  const domainGaps: string[] = [];
  for (const conceptId of primaryIds) {
    const concept = ontologyCache.getById(conceptId);
    if (!concept) continue;

    for (const relation of concept.relations) {
      if (!['uses', 'trained_on', 'solves'].includes(relation.type)) continue;
      if (resolvedIds.has(relation.target)) continue;
      const target = ontologyCache.getById(relation.target);
      if (target && !domainGaps.includes(target.label)) domainGaps.push(target.label);
    }
  }

  const unresolvedEntities = [...new Set(
    ontology
      .filter((resolution) => resolution.matchType === "unknown")
      .map((resolution) => resolution.rawInput),
  )];

  const fieldCoverage = 1 - missingFields.length / EXPECTED_FIELDS.length;
  const sectionCoverage = 1 - missingSections.length / EXPECTED_SECTIONS.length;
  const coverageScore = Math.max(0, Math.min(1, (fieldCoverage + sectionCoverage) / 2));

  return {
    missingFields,
    structuralGaps,
    domainGaps: domainGaps.slice(0, 5),
    missingSections,
    unresolvedEntities,
    coverageScore,
  };
}

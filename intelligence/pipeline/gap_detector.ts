import type {
  ExpectedSection,
  KnowledgeCore,
  KnowledgeGap,
  ResolvedConcept,
} from "../types";
import type { SectionTitle } from "./types";

const RESEARCH_SECTIONS: ExpectedSection[] = [
  "abstract",
  "methodology",
  "results",
  "conclusion",
];

export function detectGaps(
  core: KnowledgeCore,
  ontology: ResolvedConcept[],
  presentSections: SectionTitle[],
): KnowledgeGap {
  const missingFields = core.documentProfile.expectedFields
    .filter((expected) => expected.applicable && expected.required)
    .filter((expected) => core.fieldStates[expected.field] !== "present")
    .map((expected) => expected.field);

  const notApplicableFields = core.documentProfile.expectedFields
    .filter((expected) => !expected.applicable)
    .map((expected) => expected.field);

  const expectedSections = core.documentProfile.kind === "research_paper"
    ? RESEARCH_SECTIONS
    : [];

  const missingSections = expectedSections.filter((section) => {
    if (section === "methodology") {
      return !presentSections.some((present) => ["methodology", "experiments"].includes(present));
    }
    if (section === "results") {
      return !presentSections.some((present) => ["results", "discussion", "conclusion"].includes(present));
    }
    return !presentSections.includes(section);
  });

  const unresolvedEntities = ontology
    .filter((resolution) => resolution.matchType === "unknown")
    .map((resolution) => resolution.rawInput);

  const observedConceptIds = new Set(
    ontology
      .filter((resolution) => resolution.matchType !== "unknown")
      .map((resolution) => resolution.concept.id),
  );
  const domainGaps = ontology
    .filter((resolution) => resolution.matchType !== "unknown")
    .flatMap((resolution) => resolution.concept.relations.map((relation) => relation.target))
    .filter((target) => !observedConceptIds.has(target))
    .filter((target, index, values) => values.indexOf(target) === index)
    .slice(0, 12);

  const requiredFieldCount = core.documentProfile.expectedFields.filter(
    (expected) => expected.applicable && expected.required,
  ).length;
  const denominator = Math.max(1, requiredFieldCount + expectedSections.length);
  const coverageScore = Math.max(
    0,
    1 - (missingFields.length + missingSections.length) / denominator,
  );

  return {
    missingFields,
    notApplicableFields,
    structuralGaps: missingFields.map((field) => `Missing required ${field.replace(/_/g, " ")}`),
    domainGaps,
    missingSections,
    unresolvedEntities,
    coverageScore,
  };
}

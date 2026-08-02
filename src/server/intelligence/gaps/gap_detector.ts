import type { KnowledgeCore, KnowledgeGap, ResolvedConcept } from "../types";
import type { SectionedDocument } from "../pipeline/types";
import { detectGaps } from "../pipeline/gap_detector";

export function detectKnowledgeGaps(
  core: KnowledgeCore,
  doc: SectionedDocument,
  ontology: ResolvedConcept[],
): KnowledgeGap {
  return detectGaps(core, ontology, doc.sections.map((section) => section.title));
}

export { detectGaps };

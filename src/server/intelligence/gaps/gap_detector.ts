// Backward-compatible adapter. The canonical implementation lives in
// pipeline/gap_detector.ts so both old and new callers use one contract.

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

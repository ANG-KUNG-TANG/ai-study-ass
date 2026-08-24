import * as intelligenceService from "@/server/services/intelligence.service";
import type {
  ConceptCandidate,
  ExtractedClaim,
  KeyPoint,
  KnowledgeCore,
} from "@/server/intelligence/types";
import type { GroundedKnowledge } from "@/server/intelligence/grounding";

export interface ValidatedGenerationContext {
  noteId: string;
  documentKind: string;
  confidence: number;
  claims: ExtractedClaim[];
  concepts: ConceptCandidate[];
  keyPoints: KeyPoint[];
  grounding: GroundedKnowledge | null;
  warnings: string[];
}

/**
 * Shared context for summary, quiz, flashcard, and chat services. Feature
 * generators should use this instead of independently mining the raw PDF.
 */
export async function getValidatedGenerationContext(
  noteId: string,
): Promise<ValidatedGenerationContext> {
  const result = await intelligenceService.getResultOrThrow(noteId);
  if (result.hasFailed()) {
    throw new Error("Validated generation context is unavailable because intelligence processing failed.");
  }

  const raw = result as unknown as Record<string, unknown>;
  const core = raw.core as KnowledgeCore | undefined;
  if (!core) {
    throw new Error("The persisted intelligence result does not contain a knowledge core.");
  }

  const claims = (core.claims ?? []).filter(
    (claim) => claim.validationStatus === "valid",
  );
  const concepts = (core.concepts ?? []).filter((concept) => concept.valid);
  const warnings = core.validation?.issues
    ?.filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message) ?? [];
  const grounding = result.grounding;

  return {
    noteId,
    documentKind: core.documentProfile?.kind ?? "unknown",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    claims,
    concepts,
    keyPoints: core.keyPoints ?? [],
    grounding,
    warnings: [
      ...warnings,
      ...(grounding?.quality.warnings ?? []),
    ],
  };
}

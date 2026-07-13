// server/entities/knowledge.entity.ts
// Pure business rules — no Mongoose, no AI SDK, no I/O.

import type { ConfidenceMode, GraphData, OntologyMatchRef, PipelineStage } from '@/server/types/Knowledge';
import type { KnowledgeCore } from '../intelligence/pipeline';
import type { AIFallbackResult, ConfidenceBreakdown, KnowledgeGap, PrologFact } from '../intelligence/types';

const SYMBOLIC_ONLY_THRESHOLD = 0.81;
const AI_REQUIRED_THRESHOLD = 0.61;

/**
 * Everything except noteId/stage/error is optional now — a 'pending' or
 * failed-stage doc has none of this populated. Only a 'complete' stage
 * doc is guaranteed to have core/graph/etc. (enforced in the entity's
 * validate(), not at the type level, since TS can't easily express
 * "these are required iff stage === 'complete'" without a discriminated
 * union — flagging that as a possible follow-up if this bites you).
 */
export interface KnowledgeEntity {
  readonly noteId: string;
  stage: PipelineStage;
  error?: string;
  core?: KnowledgeCore;
  ontologyMatches?: OntologyMatchRef[];
  graph?: GraphData;
  prologFacts?: PrologFact[];
  gaps?: KnowledgeGap;
  confidenceBreakdown?: ConfidenceBreakdown;
  confidence?: number;
  aiFallback?: AIFallbackResult;
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeEntity {
  constructor(
    public readonly noteId: string,
    public stage: PipelineStage,
    public error?: string,
    public core?: KnowledgeCore,
    public ontologyMatches?: OntologyMatchRef[],
    public graph?: GraphData,
    public prologFacts?: PrologFact[],
    public gaps?: KnowledgeGap,
    public confidenceBreakdown?: ConfidenceBreakdown,
    public confidence?: number,
    public aiFallback?: AIFallbackResult,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public processedAt?: Date,
  ) {
    this.validate();
  }

  validate(): void {
  if (!this.noteId) {
    throw new Error("Knowledge must belong to a note.");
  }

  if (this.stage === "complete") {
    if (!this.core) {
      throw new Error("Completed knowledge requires core knowledge.");
    }

    if (!this.graph) {
      throw new Error("Completed knowledge requires a graph.");
    }

    if (this.confidence === undefined) {
      throw new Error("Completed knowledge requires a confidence score.");
    }
  }

  if (this.stage !== "complete" && this.confidence !== undefined) {
    throw new Error("Only completed knowledge can have a confidence score.");
  }
}
}


export type CreateKnowledgeInput = Omit<KnowledgeEntity, 'createdAt' | 'updatedAt'>;

export function validate(knowledge: KnowledgeEntity): string[] {
  const errors: string[] = [];
  if (!knowledge.noteId) errors.push('noteId is required');

  if (knowledge.stage !== 'complete') {
    // Pending/failed docs only need noteId + stage; nothing else applies.
    return errors;
  }

  if (knowledge.confidence === undefined || knowledge.confidence < 0 || knowledge.confidence > 1) {
    errors.push('confidence must be between 0 and 1 for a complete result');
  }
  if (!knowledge.core) errors.push('core is required for a complete result');
  if (!Array.isArray(knowledge.prologFacts)) errors.push('prologFacts must be an array for a complete result');
  if (!knowledge.graph || !Array.isArray(knowledge.graph.nodes)) {
    errors.push('graph.nodes must be an array for a complete result');
  }
  if (!knowledge.gaps) errors.push('gaps is required for a complete result');
  return errors;
}

/** Lifecycle check — mirrors the old IntelligenceResultEntity.isComplete(): "did the pipeline finish". */
export function isComplete(knowledge: KnowledgeEntity): boolean {
  return knowledge.stage === 'complete';
}

/** Mirrors the old IntelligenceResultEntity.hasFailed(). */
export function hasFailed(knowledge: KnowledgeEntity): boolean {
  return knowledge.stage !== 'complete' && !!knowledge.error;
}

/** Data-quality check — renamed from the collision with isComplete() above. */
export function hasFullCoreData(knowledge: KnowledgeEntity): boolean {
  return (
    isComplete(knowledge) &&
    !!knowledge.core &&
    knowledge.core.method !== null &&
    knowledge.core.dataset !== null &&
    knowledge.core.entities.length > 0 &&
    (knowledge.graph?.nodes.length ?? 0) > 0 &&
    (knowledge.prologFacts?.length ?? 0) > 0
  );
}

export function hasKnowledgeGaps(knowledge: KnowledgeEntity): boolean {
  if (!knowledge.gaps) return false;
  return (
    knowledge.gaps.missingFields.length > 0 ||
    knowledge.gaps.missingSections.length > 0 ||
    knowledge.gaps.unresolvedEntities.length > 0
  );
}

export function getConfidenceMode(knowledge: KnowledgeEntity): ConfidenceMode {
  const confidence = knowledge.confidence ?? 0;
  if (confidence >= SYMBOLIC_ONLY_THRESHOLD) return 'SYMBOLIC_ONLY';
  if (confidence >= AI_REQUIRED_THRESHOLD) return 'SYMBOLIC_WITH_OPTIONAL_AI_POLISH';
  return 'AI_REQUIRED';
}

export function canGenerateQuiz(knowledge: KnowledgeEntity): boolean {
  return hasFullCoreData(knowledge) && (knowledge.prologFacts?.length ?? 0) >= 3;
}

export function canGenerateSummary(knowledge: KnowledgeEntity): boolean {
  if (!isComplete(knowledge) || !knowledge.core) return false;
  return knowledge.core.keyPoints.length > 0 || (knowledge.core.extras?.keywords.length ?? 0) > 0;
}

export function canChat(knowledge: KnowledgeEntity): boolean {
  if (!isComplete(knowledge) || !knowledge.core) return false;
  return knowledge.core.entities.length > 0 || (knowledge.graph?.nodes.length ?? 0) > 0;
}

export function requiresReprocessing(knowledge: KnowledgeEntity): boolean {
  if (!isComplete(knowledge)) return true; // pending/failed always needs a (re)run
  return (
    !hasFullCoreData(knowledge) &&
    hasKnowledgeGaps(knowledge) &&
    (knowledge.gaps?.coverageScore ?? 0) < AI_REQUIRED_THRESHOLD
  );
}
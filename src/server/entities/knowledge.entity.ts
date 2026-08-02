// server/entities/knowledge.entity.ts
// Pure business rules — no Mongoose, provider SDKs, or I/O.

import type {
  ConfidenceMode,
  GraphData,
  OntologyMatchRef,
  PipelineStage,
} from "@/server/types/Knowledge";
import type { KnowledgeCore } from "@/server/intelligence/types";
import type {
  AIFallbackResult,
  ConfidenceBreakdown,
  KnowledgeGap,
  PrologFact,
} from "@/server/intelligence/types";

const SYMBOLIC_ONLY_THRESHOLD = 0.81;
const AI_REQUIRED_THRESHOLD = 0.61;

export interface KnowledgeProps {
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
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateKnowledgeInput =
  Omit<KnowledgeProps, "createdAt" | "updatedAt"> &
  Partial<Pick<KnowledgeProps, "createdAt" | "updatedAt">>;

export class KnowledgeEntity implements KnowledgeProps {
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
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: KnowledgeProps) {
    this.noteId = props.noteId;
    this.stage = props.stage;
    this.error = props.error;
    this.core = props.core;
    this.ontologyMatches = props.ontologyMatches;
    this.graph = props.graph;
    this.prologFacts = props.prologFacts;
    this.gaps = props.gaps;
    this.confidenceBreakdown = props.confidenceBreakdown;
    this.confidence = props.confidence;
    this.aiFallback = props.aiFallback;
    this.processedAt = props.processedAt;
    this.createdAt = new Date(props.createdAt);
    this.updatedAt = new Date(props.updatedAt);
    this.validate();
  }

  static create(input: CreateKnowledgeInput): KnowledgeEntity {
    const now = new Date();
    return new KnowledgeEntity({
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
  }

  static fromPersistence(input: KnowledgeProps): KnowledgeEntity {
    return new KnowledgeEntity(input);
  }

  validate(): void {
    const errors = validate(this);
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
  }

  toPersistence(): KnowledgeProps {
    return {
      noteId: this.noteId,
      stage: this.stage,
      error: this.error,
      core: this.core,
      ontologyMatches: this.ontologyMatches,
      graph: this.graph,
      prologFacts: this.prologFacts,
      gaps: this.gaps,
      confidenceBreakdown: this.confidenceBreakdown,
      confidence: this.confidence,
      aiFallback: this.aiFallback,
      processedAt: this.processedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export function validate(knowledge: Pick<KnowledgeProps,
  "noteId" | "stage" | "core" | "graph" | "prologFacts" | "gaps" | "confidence"
>): string[] {
  const errors: string[] = [];

  if (!knowledge.noteId) errors.push("noteId is required");

  if (knowledge.stage !== "complete") {
    if (knowledge.confidence !== undefined) {
      errors.push("only complete knowledge may have a confidence score");
    }
    return errors;
  }

  if (
    knowledge.confidence === undefined ||
    knowledge.confidence < 0 ||
    knowledge.confidence > 1
  ) {
    errors.push("confidence must be between 0 and 1 for a complete result");
  }

  if (!knowledge.core) errors.push("core is required for a complete result");
  if (!Array.isArray(knowledge.prologFacts)) {
    errors.push("prologFacts must be an array for a complete result");
  }
  if (!knowledge.graph || !Array.isArray(knowledge.graph.nodes)) {
    errors.push("graph.nodes must be an array for a complete result");
  }
  if (!knowledge.gaps) errors.push("gaps is required for a complete result");

  return errors;
}

export function isComplete(knowledge: Pick<KnowledgeProps, "stage">): boolean {
  return knowledge.stage === "complete";
}

export function hasFailed(
  knowledge: Pick<KnowledgeProps, "stage" | "error">,
): boolean {
  return knowledge.stage !== "complete" && Boolean(knowledge.error);
}

export function hasFullCoreData(knowledge: KnowledgeEntity): boolean {
  return (
    isComplete(knowledge) &&
    Boolean(knowledge.core) &&
    knowledge.core?.method !== null &&
    knowledge.core?.dataset !== null &&
    (knowledge.core?.entities.length ?? 0) > 0 &&
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

export function getConfidenceMode(
  knowledge: Pick<KnowledgeProps, "confidence">,
): ConfidenceMode {
  const confidence = knowledge.confidence ?? 0;
  if (confidence >= SYMBOLIC_ONLY_THRESHOLD) return "SYMBOLIC_ONLY";
  if (confidence >= AI_REQUIRED_THRESHOLD) {
    return "SYMBOLIC_WITH_OPTIONAL_AI_POLISH";
  }
  return "AI_REQUIRED";
}

export function canGenerateQuiz(knowledge: KnowledgeEntity): boolean {
  return hasFullCoreData(knowledge) && (knowledge.prologFacts?.length ?? 0) >= 3;
}

export function canGenerateSummary(knowledge: KnowledgeEntity): boolean {
  if (!isComplete(knowledge) || !knowledge.core) return false;
  return (
    knowledge.core.keyPoints.length > 0 ||
    (knowledge.core.extras?.keywords.length ?? 0) > 0
  );
}

export function canChat(knowledge: KnowledgeEntity): boolean {
  if (!isComplete(knowledge) || !knowledge.core) return false;
  return (
    knowledge.core.entities.length > 0 ||
    (knowledge.graph?.nodes.length ?? 0) > 0
  );
}

export function requiresReprocessing(knowledge: KnowledgeEntity): boolean {
  if (!isComplete(knowledge)) return true;
  return (
    !hasFullCoreData(knowledge) &&
    hasKnowledgeGaps(knowledge) &&
    (knowledge.gaps?.coverageScore ?? 0) < AI_REQUIRED_THRESHOLD
  );
}

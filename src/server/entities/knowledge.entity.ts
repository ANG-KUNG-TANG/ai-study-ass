// server/entities/knowledge.entity.ts
// Pure business rules — no Mongoose, AI SDK, or I/O.

import type {
  ConfidenceMode,
  GraphData,
  OntologyMatchRef,
  PipelineStage,
} from "@/server/types/Knowledge";
import type {
  KnowledgeCore,
} from "@/server/intelligence/pipeline";
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
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export type CreateKnowledgeInput =
  Omit<
    KnowledgeProps,
    "createdAt" | "updatedAt"
  > & {
    createdAt?: Date;
    updatedAt?: Date;
  };

function validateConfidence(
  confidence: number | undefined,
): void {
  if (
    confidence !== undefined &&
    (
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    )
  ) {
    throw new Error(
      "Knowledge confidence must be between 0 and 1.",
    );
  }
}

function validateCompleteKnowledge(
  knowledge: Pick<
    KnowledgeProps,
    | "core"
    | "graph"
    | "prologFacts"
    | "gaps"
    | "confidence"
  >,
): void {
  if (!knowledge.core) {
    throw new Error(
      "Completed knowledge requires core knowledge.",
    );
  }

  if (!knowledge.graph) {
    throw new Error(
      "Completed knowledge requires a graph.",
    );
  }

  if (
    !Array.isArray(
      knowledge.graph.nodes,
    ) ||
    !Array.isArray(
      knowledge.graph.edges,
    )
  ) {
    throw new Error(
      "Completed knowledge requires graph node and edge arrays.",
    );
  }

  if (
    !Array.isArray(
      knowledge.prologFacts,
    )
  ) {
    throw new Error(
      "Completed knowledge requires a prologFacts array.",
    );
  }

  if (!knowledge.gaps) {
    throw new Error(
      "Completed knowledge requires gap information.",
    );
  }

  if (
    knowledge.confidence === undefined
  ) {
    throw new Error(
      "Completed knowledge requires a confidence score.",
    );
  }
}

export class KnowledgeEntity {
  public readonly noteId: string;
  public stage: PipelineStage;
  public error?: string;
  public core?: KnowledgeCore;
  public ontologyMatches?: OntologyMatchRef[];
  public graph?: GraphData;
  public prologFacts?: PrologFact[];
  public gaps?: KnowledgeGap;
  public confidenceBreakdown?: ConfidenceBreakdown;
  public confidence?: number;
  public aiFallback?: AIFallbackResult;
  public createdAt: Date;
  public updatedAt: Date;
  public processedAt?: Date;

  constructor(
    noteId: string,
    stage: PipelineStage,
    error?: string,
    core?: KnowledgeCore,
    ontologyMatches?: OntologyMatchRef[],
    graph?: GraphData,
    prologFacts?: PrologFact[],
    gaps?: KnowledgeGap,
    confidenceBreakdown?: ConfidenceBreakdown,
    confidence?: number,
    aiFallback?: AIFallbackResult,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
    processedAt?: Date,
  ) {
    this.noteId = noteId;
    this.stage = stage;
    this.error = error;
    this.core = core;
    this.ontologyMatches =
      ontologyMatches;
    this.graph = graph;
    this.prologFacts =
      prologFacts;
    this.gaps = gaps;
    this.confidenceBreakdown =
      confidenceBreakdown;
    this.confidence = confidence;
    this.aiFallback = aiFallback;
    this.createdAt =
      new Date(createdAt);
    this.updatedAt =
      new Date(updatedAt);
    this.processedAt =
      processedAt
        ? new Date(processedAt)
        : undefined;

    this.validate();
  }

  static create(
    input: CreateKnowledgeInput,
  ): KnowledgeEntity {
    return new KnowledgeEntity(
      input.noteId,
      input.stage,
      input.error,
      input.core,
      input.ontologyMatches,
      input.graph,
      input.prologFacts,
      input.gaps,
      input.confidenceBreakdown,
      input.confidence,
      input.aiFallback,
      input.createdAt ??
        new Date(),
      input.updatedAt ??
        new Date(),
      input.processedAt,
    );
  }

  static fromPersistence(
    input: KnowledgeProps,
  ): KnowledgeEntity {
    return KnowledgeEntity.create(
      input,
    );
  }

  validate(): void {
    if (!this.noteId.trim()) {
      throw new Error(
        "Knowledge must belong to a note.",
      );
    }

    validateConfidence(
      this.confidence,
    );

    if (
      this.stage === "complete"
    ) {
      validateCompleteKnowledge(
        this,
      );
    }
  }

  isComplete(): boolean {
    return isComplete(this);
  }

  hasFailed(): boolean {
    return hasFailed(this);
  }

  getConfidenceMode():
    ConfidenceMode {
    return getConfidenceMode(
      this,
    );
  }

  toProps(): KnowledgeProps {
    return {
      noteId:
        this.noteId,
      stage:
        this.stage,
      error:
        this.error,
      core:
        this.core,
      ontologyMatches:
        this.ontologyMatches
          ? [...this.ontologyMatches]
          : undefined,
      graph:
        this.graph,
      prologFacts:
        this.prologFacts
          ? [...this.prologFacts]
          : undefined,
      gaps:
        this.gaps,
      confidenceBreakdown:
        this.confidenceBreakdown,
      confidence:
        this.confidence,
      aiFallback:
        this.aiFallback,
      createdAt:
        new Date(this.createdAt),
      updatedAt:
        new Date(this.updatedAt),
      processedAt:
        this.processedAt
          ? new Date(
              this.processedAt,
            )
          : undefined,
    };
  }
}

export function validate(
  knowledge: KnowledgeProps,
): string[] {
  const errors: string[] = [];

  if (
    !knowledge.noteId?.trim()
  ) {
    errors.push(
      "noteId is required",
    );
  }

  if (
    knowledge.confidence !== undefined &&
    (
      !Number.isFinite(
        knowledge.confidence,
      ) ||
      knowledge.confidence < 0 ||
      knowledge.confidence > 1
    )
  ) {
    errors.push(
      "confidence must be between 0 and 1",
    );
  }

  if (
    knowledge.stage !== "complete"
  ) {
    return errors;
  }

  if (!knowledge.core) {
    errors.push(
      "core is required for a complete result",
    );
  }

  if (
    !knowledge.graph ||
    !Array.isArray(
      knowledge.graph.nodes,
    ) ||
    !Array.isArray(
      knowledge.graph.edges,
    )
  ) {
    errors.push(
      "graph nodes and edges must be arrays for a complete result",
    );
  }

  if (
    !Array.isArray(
      knowledge.prologFacts,
    )
  ) {
    errors.push(
      "prologFacts must be an array for a complete result",
    );
  }

  if (!knowledge.gaps) {
    errors.push(
      "gaps is required for a complete result",
    );
  }

  if (
    knowledge.confidence === undefined
  ) {
    errors.push(
      "confidence is required for a complete result",
    );
  }

  return errors;
}

export function isComplete(
  knowledge: Pick<
    KnowledgeProps,
    "stage"
  >,
): boolean {
  return (
    knowledge.stage === "complete"
  );
}

export function hasFailed(
  knowledge: Pick<
    KnowledgeProps,
    "stage" | "error"
  >,
): boolean {
  return (
    knowledge.stage !== "complete" &&
    Boolean(
      knowledge.error?.trim(),
    )
  );
}

/**
 * Reports whether rich symbolic data is available.
 * This is a quality signal, not permission to block generation.
 */
export function hasFullCoreData(
  knowledge: KnowledgeProps,
): boolean {
  return (
    isComplete(knowledge) &&
    Boolean(knowledge.core) &&
    (
      (
        knowledge.core
          ?.keyPoints.length ??
        0
      ) > 0 ||
      (
        knowledge.core
          ?.entities.length ??
        0
      ) > 0 ||
      (
        knowledge.graph
          ?.nodes.length ??
        0
      ) > 0 ||
      (
        knowledge.prologFacts
          ?.length ??
        0
      ) > 0
    )
  );
}

export function hasKnowledgeGaps(
  knowledge: Pick<
    KnowledgeProps,
    "gaps"
  >,
): boolean {
  if (!knowledge.gaps) {
    return false;
  }

  return (
    knowledge.gaps
      .missingFields.length > 0 ||
    knowledge.gaps
      .missingSections.length > 0 ||
    knowledge.gaps
      .unresolvedEntities.length > 0
  );
}

export function getConfidenceMode(
  knowledge: Pick<
    KnowledgeProps,
    "confidence"
  >,
): ConfidenceMode {
  const confidence =
    knowledge.confidence ?? 0;

  if (
    confidence >=
    SYMBOLIC_ONLY_THRESHOLD
  ) {
    return "SYMBOLIC_ONLY";
  }

  if (
    confidence >=
    AI_REQUIRED_THRESHOLD
  ) {
    return "SYMBOLIC_WITH_OPTIONAL_AI_POLISH";
  }

  return "AI_REQUIRED";
}

/**
 * These functions only report structured-data availability.
 * Feature services may still generate from the extracted source text.
 */
export function canGenerateQuiz(
  knowledge: KnowledgeProps,
): boolean {
  return (
    isComplete(knowledge) &&
    (
      (
        knowledge.prologFacts
          ?.length ??
        0
      ) > 0 ||
      (
        knowledge.core
          ?.keyPoints.length ??
        0
      ) > 0 ||
      (
        knowledge.core
          ?.entities.length ??
        0
      ) > 0
    )
  );
}

export function canGenerateSummary(
  knowledge: KnowledgeProps,
): boolean {
  return (
    isComplete(knowledge) &&
    Boolean(knowledge.core) &&
    (
      (
        knowledge.core
          ?.keyPoints.length ??
        0
      ) > 0 ||
      (
        knowledge.core
          ?.entities.length ??
        0
      ) > 0 ||
      Boolean(
        knowledge.core
          ?.problem,
      ) ||
      Boolean(
        knowledge.core
          ?.method,
      ) ||
      (
        knowledge.core
          ?.extras
          ?.keywords.length ??
        0
      ) > 0
    )
  );
}

export function canChat(
  knowledge: KnowledgeProps,
): boolean {
  return (
    isComplete(knowledge) &&
    (
      (
        knowledge.core
          ?.entities.length ??
        0
      ) > 0 ||
      (
        knowledge.core
          ?.keyPoints.length ??
        0
      ) > 0 ||
      (
        knowledge.graph
          ?.nodes.length ??
        0
      ) > 0 ||
      (
        knowledge.prologFacts
          ?.length ??
        0
      ) > 0
    )
  );
}

export function requiresReprocessing(
  knowledge: KnowledgeProps,
): boolean {
  if (
    !isComplete(knowledge)
  ) {
    return true;
  }

  return (
    hasKnowledgeGaps(
      knowledge,
    ) &&
    (
      knowledge.gaps
        ?.coverageScore ??
      0
    ) <
      AI_REQUIRED_THRESHOLD
  );
}

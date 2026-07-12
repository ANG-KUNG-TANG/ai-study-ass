import { ValidationError } from "@/server/utils/errors";
import type { KnowledgeCore, KnowledgeGraph, PrologFact, ResolvedConcept, GapDetectionResult } from "@/server/intelligence/types";

export const INTELLIGENCE_RULES = {
  symbolicOnlyThreshold: 0.81,
  aiRequiredThreshold: 0.61,
} as const;

export type IntelligenceStage = "extraction" | "ontology" | "graph" | "prolog" | "complete";
export type ConfidenceMode = "SYMBOLIC_ONLY" | "SYMBOLIC_WITH_OPTIONAL_AI_POLISH" | "AI_REQUIRED";

export interface IntelligenceResultProps {
  noteId: string;
  stage: IntelligenceStage;
  core: KnowledgeCore | null;
  ontology: ResolvedConcept[];
  graph: KnowledgeGraph | null;
  facts: PrologFact[];
  confidence: number | null;
  failedStage: IntelligenceStage | null;
  failedReason: string | null;
  processedAt: Date;
  gaps?: GapDetectionResult | null;
}

function validateConfidence(confidence: number): void {
  if (confidence < 0 || confidence > 1) {
    throw new ValidationError("Validation failed", { confidence: "Confidence must be between 0 and 1" });
  }
}

export class IntelligenceResultEntity {
  readonly #noteId: string;
  readonly #stage: IntelligenceStage;
  readonly #core: KnowledgeCore | null;
  readonly #ontology: ResolvedConcept[];
  readonly #graph: KnowledgeGraph | null;
  readonly #facts: PrologFact[];
  readonly #confidence: number | null;
  readonly #failedStage: IntelligenceStage | null;
  readonly #failedReason: string | null;
  readonly #processedAt: Date;
  readonly #gaps: GapDetectionResult | null;
  data: any;

  private constructor(props: IntelligenceResultProps) {
    this.#noteId = props.noteId;
    this.#stage = props.stage;
    this.#core = props.core;
    this.#ontology = props.ontology;
    this.#graph = props.graph;
    this.#facts = props.facts;
    this.#confidence = props.confidence;
    this.#failedStage = props.failedStage;
    this.#failedReason = props.failedReason;
    this.#processedAt = props.processedAt;
    this.#gaps = props.gaps ?? null;
  }

  get noteId(): string { return this.#noteId; }
  get stage(): IntelligenceStage { return this.#stage; }
  get core(): KnowledgeCore | null { return this.#core; }
  get ontology(): ResolvedConcept[] { return this.#ontology; }
  get graph(): KnowledgeGraph | null { return this.#graph; }
  get facts(): PrologFact[] { return this.#facts; }
  get confidence(): number | null { return this.#confidence; }
  get failedStage(): IntelligenceStage | null { return this.#failedStage; }
  get failedReason(): string | null { return this.#failedReason; }
  get processedAt(): Date { return this.#processedAt; }
  get gaps(): GapDetectionResult | null { return this.#gaps; }

  static createSuccess(input: {
    noteId: string;
    stage: IntelligenceStage;
    core: KnowledgeCore;
    ontology: ResolvedConcept[];
    graph: KnowledgeGraph;
    facts: PrologFact[];
    confidence: number;
    processedAt: Date;
    gaps?: GapDetectionResult | null;
  }): IntelligenceResultEntity {
    validateConfidence(input.confidence);
    return new IntelligenceResultEntity({ ...input, failedStage: null, failedReason: null });
  }

  static createFailed(noteId: string, failedStage: IntelligenceStage, reason?: string): IntelligenceResultEntity {
    return new IntelligenceResultEntity({
      noteId, stage: failedStage, core: null, ontology: [], graph: null, facts: [],
      confidence: null, failedStage, failedReason: reason ?? null, processedAt: new Date(), gaps: null,
    });
  }

  static fromPersistence(props: IntelligenceResultProps): IntelligenceResultEntity {
    return new IntelligenceResultEntity(props);
  }

  belongsToNote(noteId: string): boolean { return this.#noteId === noteId; }
  isComplete(): boolean { return this.#stage === "complete" && this.#failedStage === null; }
  hasFailed(): boolean { return this.#failedStage !== null; }

  getConfidenceMode(): ConfidenceMode {
    if (!this.isComplete() || this.#confidence === null) return "AI_REQUIRED";
    if (this.#confidence >= INTELLIGENCE_RULES.symbolicOnlyThreshold) return "SYMBOLIC_ONLY";
    if (this.#confidence >= INTELLIGENCE_RULES.aiRequiredThreshold) return "SYMBOLIC_WITH_OPTIONAL_AI_POLISH";
    return "AI_REQUIRED";
  }

  needsAIFallback(): boolean { return this.getConfidenceMode() === "AI_REQUIRED"; }
  canUseOptionalAIPolish(): boolean { return this.getConfidenceMode() === "SYMBOLIC_WITH_OPTIONAL_AI_POLISH"; }
  hasReasoningData(): boolean { return this.#graph !== null && this.#facts.length > 0; }
  resolvedConcepts(): ResolvedConcept[] { return this.#ontology.filter((r) => r.matchType !== "unknown"); }

  toPublic(): IntelligenceResultProps {
    return {
      noteId: this.#noteId, stage: this.#stage, core: this.#core, ontology: this.#ontology,
      graph: this.#graph, facts: this.#facts, confidence: this.#confidence,
      failedStage: this.#failedStage, failedReason: this.#failedReason, processedAt: this.#processedAt,
      gaps: this.#gaps,
    };
  }

  toPersistence(): IntelligenceResultProps { return this.toPublic(); }
}


/**
 * Below this confidence score, the symbolic pipeline's output is considered
 * unreliable enough to warrant AI-assisted completion. 0.7 is a starting
 * point, not a measured value — tune it once you have real papers running
 * through the pipeline and can see where the weighted score actually lands
 * for documents you'd manually judge as "good enough" vs "needs help".
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

/**
 * The single decision point for the doc's High/Low branch:
 *   Confidence >= Threshold → Symbolic Features (no AI needed)
 *   Confidence <  Threshold → AI-Assisted Completion
 *
 * Kept as a pure function (confidence in, boolean out) rather than reading
 * a global config value, so it's trivially testable and so engine.ts (or
 * any feature service) can override the threshold per-call if a specific
 * paper type warrants a different bar, without touching this file.
 */
export function needsAIFallback(
  confidence: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): boolean {
  return confidence < threshold;
}

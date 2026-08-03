import type {
  AIGenerateFn,
  ConfidenceBreakdown,
  IntelligenceResult,
  IntelligenceStageId,
  IntelligenceStageProgress,
  KnowledgeCore,
  KnowledgeGap,
  KnowledgeGraph,
  NLPResult,
  PipelineProgressListener,
  PipelineStage,
  PrologFact,
  ResolvedConcept,
} from "./types";
import type {
  DocumentChunk,
  RawDocument,
  SectionedDocument,
} from "./pipeline";
import {
  buildDocumentChunks,
  classifyDocument,
  cleanDocument,
  detectSections,
  extractKnowledge,
  runNLPPipeline,
  validateKnowledge,
} from "./pipeline";
import { ontologyCache } from "./ontology/ontology.cache";
import { buildGraph } from "./graph/graph.engine";
import { PrologEngine, quoteAtom } from "./prolog/prolog.engine";
import { detectGaps } from "./pipeline/gap_detector";
import { computeConfidenceBreakdown } from "./confidence/confidence.engine";
import { completeWithAI } from "./fallback/ai_fallback.service";
import {
  attachReliableProfile,
  buildReliableProfile,
  calibrateConfidenceBreakdown,
  getReliableProfile,
} from "./reliability/profile";
import { createPendingStageProgress } from "./stage-catalog";

const DEFAULT_AI_FALLBACK_THRESHOLD = 0.85;


export interface EngineInput {
  noteId: string;
  document: RawDocument;
  aiGenerate?: AIGenerateFn;
  onProgress?: PipelineProgressListener;
  aiFallbackThreshold?: number;
}

export class PipelineError extends Error {
  readonly stage: PipelineStage;
  readonly noteId: string;
  readonly cause: unknown;

  constructor(stage: PipelineStage, noteId: string, cause: unknown) {
    super(`Pipeline failed at stage '${stage}' for note ${noteId}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "PipelineError";
    this.stage = stage;
    this.noteId = noteId;
    this.cause = cause;
  }
}

interface SymbolicResult {
  graph: KnowledgeGraph;
  prologEngine: PrologEngine;
  facts: PrologFact[];
  gaps: KnowledgeGap;
  confidenceBreakdown: ConfidenceBreakdown;
  prologWarnings: string[];
}

export async function runPipeline(input: EngineInput): Promise<IntelligenceResult> {
  const tracker = new ProgressTracker(input.onProgress);
  const { noteId, document } = input;
  const threshold = input.aiFallbackThreshold ?? DEFAULT_AI_FALLBACK_THRESHOLD;

  await tracker.complete("document_received", {
    metrics: {
      fileSize: document.fileSize,
      pageCount: document.pageCount ?? document.pages?.length ?? 0,
      rawCharacters: document.rawText.length,
    },
  });

  let sectioned: SectionedDocument;
  let chunks: DocumentChunk[];
  let nlp: NLPResult;
  let core: KnowledgeCore;

  try {
    const cleaned = await tracker.run("cleaning", () => cleanDocument(document), (value) => ({
      cleanCharacters: value.cleanText.length,
      citationsRemoved: value.cleaningStats.citationsRemoved,
      referenceLinesRemoved: value.cleaningStats.referenceLinesRemoved,
    }));

    sectioned = await tracker.run("section_detection", () => detectSections(cleaned), (value) => ({
      sections: value.sections.length,
      hasAbstract: value.hasAbstract,
      hasMethodology: value.hasMethodology,
    }));

    const profile = await tracker.run("document_classification", () => classifyDocument(sectioned), (value) => ({
      kind: value.kind,
      classificationConfidence: Number(value.confidence.toFixed(3)),
    }));

    chunks = await tracker.run("chunking", () => buildDocumentChunks(sectioned), (value) => ({
      chunks: value.length,
      estimatedTokens: value.reduce((sum, chunk) => sum + chunk.tokenEstimate, 0),
    }));

    nlp = await tracker.run("nlp", () => runNLPPipeline(sectioned), (value) => ({
      sentences: value.sentences.length,
      entities: value.entities.length,
      keyPhrases: value.keyPhrases.length,
    }));

    core = await tracker.run("claim_extraction", () => extractKnowledge(sectioned, nlp, profile), (value) => ({
      claims: value.claims.length,
      concepts: value.concepts.length,
    }));

    core = await tracker.run("claim_validation", () => validateKnowledge(core), (value) => ({
      validClaims: value.validation.validClaimIds.length,
      rejectedClaims: value.validation.rejectedClaimIds.length,
      validConcepts: value.validation.validConceptIds.length,
      validationPassed: value.validation.passed,
    }));
    // reliability profile: deterministic quality gate
    const reliabilityProfile =
      buildReliableProfile({
        raw:
          document,
        document:
          sectioned,
        nlp,
        core,
      });

    core =
      attachReliableProfile(
        core,
        reliabilityProfile,
      );
  } catch (error) {
    throw new PipelineError("extraction", noteId, error);
  }

  ensureOntologyLoaded();

  let ontology = await tracker.run("ontology_resolution", () => resolveCoreOntology(core), (value) => ({
    resolved: value.filter((item) => item.matchType !== "unknown").length,
    documentLocal: value.filter((item) => item.matchType === "unknown").length,
  }));

  let symbolic = await runSymbolicStages({ noteId, core, sectioned, nlp, ontology, tracker });

  // reliability calibration: first symbolic pass
  symbolic = {
    ...symbolic,
    confidenceBreakdown:
      calibrateConfidenceBreakdown(
        symbolic.confidenceBreakdown,
        getReliableProfile(
          core,
        ),
      ),
  };

  let aiFallback: IntelligenceResult["aiFallback"] = { used: false, filledFields: [] };
  const needsRepair = symbolic.gaps.missingFields.length > 0 || symbolic.confidenceBreakdown.overall < threshold;

  if (!needsRepair) {
    await tracker.skip("ai_repair", "All required fields are present and confidence is above the repair threshold.");
  } else if (!input.aiGenerate) {
    aiFallback = {
      used: false,
      filledFields: [],
      skippedReason: "AI repair was needed, but no AI generator was supplied.",
    };
    await tracker.skip("ai_repair", aiFallback.skippedReason ?? "AI repair was skipped.");
  } else {
    const repair = await tracker.run("ai_repair", async () => {
      const result = await completeWithAI(
        core,
        symbolic.gaps,
        buildFallbackSource(sectioned, chunks),
        input.aiGenerate!,
      );
      aiFallback = result.result;
      if (!result.result.used) return { repairedCore: core, used: false };
      return { repairedCore: validateKnowledge(result.core), used: true };
    }, (value) => ({
      used: value.used,
      filledFields: aiFallback.filledFields.join(", ") || "none",
      acceptedClaims: aiFallback.acceptedClaimIds?.length ?? 0,
      rejectedClaims: aiFallback.rejectedClaims?.length ?? 0,
    }));

    if (repair.used) {
      core = repair.repairedCore;

      // reliability profile: rebuild after AI repair
      core =
        attachReliableProfile(
          core,
          buildReliableProfile({
            raw:
              document,
            document:
              sectioned,
            nlp,
            core,
          }),
        );

      ontology = resolveCoreOntology(core);
      symbolic = await rerunSymbolicStages(noteId, core, sectioned, nlp, ontology);

      // reliability calibration: post-AI pass
      symbolic = {
        ...symbolic,
        confidenceBreakdown:
          calibrateConfidenceBreakdown(
            symbolic.confidenceBreakdown,
            getReliableProfile(
              core,
            ),
          ),
      };
    }
  }

  await tracker.complete("complete", {
    message: `${core.validation.validClaimIds.length} validated claims and ${core.validation.validConceptIds.length} concepts are ready.`,
    metrics: {
      confidence: Number(symbolic.confidenceBreakdown.overall.toFixed(3)),
      validatedClaims: core.validation.validClaimIds.length,
      graphNodes: symbolic.graph.nodes.size,
      graphEdges: symbolic.graph.edges.length,
    },
  });

  return {
    noteId,
    stage: "complete",
    nlp,
    core,
    ontology,
    graph: symbolic.graph,
    prolog: { engine: symbolic.prologEngine, facts: symbolic.facts },
    gaps: symbolic.gaps,
    confidenceBreakdown: symbolic.confidenceBreakdown,
    confidence: symbolic.confidenceBreakdown.overall,
    aiFallback,
    stageProgress: tracker.snapshot(),
    processedAt: new Date(),
  };
}

async function runSymbolicStages(input: {
  noteId: string;
  core: KnowledgeCore;
  sectioned: SectionedDocument;
  nlp: NLPResult;
  ontology: ResolvedConcept[];
  tracker: ProgressTracker;
}): Promise<SymbolicResult> {
  const graph = await input.tracker.run("graph_construction", () => buildGraph(input.core, ontologyCache, input.noteId), (value) => ({
    nodes: value.nodes.size,
    edges: value.edges.length,
  }));

  const reasoning = await input.tracker.run("symbolic_reasoning", () => loadReasoning(graph, input.noteId), (value) => ({
    facts: value.facts.length,
    keyFacts: value.answerCount,
    degraded: value.warnings.length > 0,
  }), { allowPartial: true });

  const gaps = await input.tracker.run("gap_detection", () => detectGaps(
    input.core,
    input.ontology,
    input.sectioned.sections.map((section) => section.title),
  ), (value) => ({
    missingRequiredFields: value.missingFields.length,
    notApplicableFields: value.notApplicableFields.length,
    coverage: Number(value.coverageScore.toFixed(3)),
  }));

  const confidenceBreakdown = await input.tracker.run("confidence_scoring", () => computeConfidenceBreakdown({
    nlp: input.nlp,
    ontology: input.ontology,
    graph,
    core: input.core,
    prologAnswerCount: reasoning.answerCount,
    gaps,
  }), (value) => ({
    overall: Number(value.overall.toFixed(3)),
    grounding: Number(value.grounding.toFixed(3)),
    numericValidation: Number(value.numericValidation.toFixed(3)),
  }));

  return {
    graph,
    prologEngine: reasoning.engine,
    facts: reasoning.facts,
    gaps,
    confidenceBreakdown,
    prologWarnings: reasoning.warnings,
  };
}

async function rerunSymbolicStages(
  noteId: string,
  core: KnowledgeCore,
  sectioned: SectionedDocument,
  nlp: NLPResult,
  ontology: ResolvedConcept[],
): Promise<SymbolicResult> {
  const graph = buildGraph(core, ontologyCache, noteId);
  const reasoning = await loadReasoning(graph, noteId);
  const gaps = detectGaps(core, ontology, sectioned.sections.map((section) => section.title));
  const confidenceBreakdown = computeConfidenceBreakdown({
    nlp,
    ontology,
    graph,
    core,
    prologAnswerCount: reasoning.answerCount,
    gaps,
  });
  return {
    graph,
    prologEngine: reasoning.engine,
    facts: reasoning.facts,
    gaps,
    confidenceBreakdown,
    prologWarnings: reasoning.warnings,
  };
}

async function loadReasoning(graph: KnowledgeGraph, noteId: string): Promise<{
  engine: PrologEngine;
  facts: PrologFact[];
  answerCount: number;
  warnings: string[];
}> {
  const engine = new PrologEngine();
  const warnings: string[] = [];
  try {
    await engine.load(graph, noteId);
    const facts = engine.getFacts();
    let answerCount = 0;
    try {
      const result = await engine.query(`key_fact(${quoteAtom(noteId)}, Type, Val)`);
      answerCount = new Set(result.answers.map((answer) => answer.bindings.Type).filter(Boolean)).size;
    } catch (error) {
      warnings.push(`Key-fact diagnostic failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { engine, facts, answerCount, warnings };
  } catch (error) {
    warnings.push(`Prolog reasoning was unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return { engine, facts: [], answerCount: 0, warnings };
  }
}

function resolveCoreOntology(core: KnowledgeCore): ResolvedConcept[] {
  const rawConcepts = [
    ...core.concepts.filter((concept) => concept.valid).map((concept) => concept.term),
    ...core.claims
      .filter((claim) => claim.validationStatus === "valid" && ["method", "tool", "data_source", "metric"].includes(claim.type))
      .map((claim) => claim.object),
  ];
  const seen = new Set<string>();
  return ontologyCache.resolveAll(rawConcepts.filter((value) => {
    const key = value.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  })).map((resolution) => ({
    ...resolution,
    status: resolution.matchType === "unknown" ? "document_local" : "ontology",
  }));
}

function ensureOntologyLoaded(): void {
  if (!ontologyCache.isLoaded()) ontologyCache.load();
}

function buildFallbackSource(sectioned: SectionedDocument, chunks: DocumentChunk[]): string {
  const priority = new Set(["abstract", "method", "implementation", "evaluation", "results", "discussion", "conclusion"]);
  const focused = chunks
    .filter((chunk) => priority.has(chunk.semanticRole))
    .map((chunk) => `[${chunk.sectionTitle}${chunk.pageStart ? `, page ${chunk.pageStart}` : ""}]\n${chunk.text}`)
    .join("\n\n");
  return focused.trim() || sectioned.analysisText;
}

class ProgressTracker {
  private readonly stages = new Map<IntelligenceStageId, IntelligenceStageProgress>();

  constructor(private readonly listener?: PipelineProgressListener) {
    for (const stage of createPendingStageProgress()) {
      this.stages.set(stage.stage, stage);
    }
  }

  async run<T>(
    stage: IntelligenceStageId,
    task: () => T | Promise<T>,
    metrics?: (value: T) => Record<string, number | string | boolean>,
    options: { allowPartial?: boolean } = {},
  ): Promise<T> {
    const startedAt = new Date();
    await this.publish(stage, { status: "running", startedAt, message: "Processing…" });
    try {
      const value = await task();
      const warnings = extractWarnings(value);
      const status = options.allowPartial && warnings.length > 0 ? "partial" : "complete";
      await this.publish(stage, {
        status,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        message: status === "partial" ? "Completed with warnings." : "Completed.",
        warnings,
        metrics: metrics?.(value),
      });
      return value;
    } catch (error) {
      await this.publish(stage, {
        status: "failed",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async complete(
    stage: IntelligenceStageId,
    patch: Partial<IntelligenceStageProgress> = {},
  ): Promise<void> {
    const now = new Date();
    await this.publish(stage, {
      status: "complete",
      startedAt: patch.startedAt ?? now,
      completedAt: patch.completedAt ?? now,
      durationMs: patch.durationMs ?? 0,
      message: patch.message ?? "Completed.",
      metrics: patch.metrics,
      warnings: patch.warnings ?? [],
    });
  }

  async skip(stage: IntelligenceStageId, reason: string): Promise<void> {
    await this.publish(stage, {
      status: "skipped",
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
      message: reason,
    });
  }

  snapshot(): IntelligenceStageProgress[] {
    return [...this.stages.values()].map((stage) => ({ ...stage, warnings: [...stage.warnings] }));
  }

  private async publish(
    stage: IntelligenceStageId,
    patch: Partial<IntelligenceStageProgress>,
  ): Promise<void> {
    const current = this.stages.get(stage)!;
    const next: IntelligenceStageProgress = {
      ...current,
      ...patch,
      warnings: patch.warnings ?? current.warnings,
    };
    this.stages.set(stage, next);
    try {
      await this.listener?.({ ...next, warnings: [...next.warnings] });
    } catch {
      // Progress delivery must never fail intelligence processing.
    }
  }
}

function extractWarnings(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const warnings = (value as { warnings?: unknown }).warnings;
  return Array.isArray(warnings) ? warnings.filter((item): item is string => typeof item === "string") : [];
}

export function buildFailedResult(
  noteId: string,
  failedAtStage: PipelineStage,
  partial: Partial<IntelligenceResult> = {},
): Pick<IntelligenceResult, "noteId" | "stage" | "processedAt"> & Partial<IntelligenceResult> {
  return { noteId, stage: failedAtStage, processedAt: new Date(), ...partial };
}

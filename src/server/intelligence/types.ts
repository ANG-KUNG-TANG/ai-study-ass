// =============================================================================
// server/intelligence/types.ts
//
// RECONSTRUCTED FILE — see note.
// -----------------------------------------------------------------------------
// The uploads for this project included two files both named `types.ts`
// (the pipeline-level server/intelligence/pipeline/types.ts and this
// intelligence-level server/intelligence/types.ts). Flattened into a single
// upload folder, the second silently overwrote the first, so this file's
// real content wasn't available to audit or edit directly.
//
// Everything below was reconstructed by reading every
// `import type {...} from '../types'` across engine.ts, graph.engine.ts,
// prolog.engine.ts, explanation.ts, ontology.cache.ts, and
// knowledge_extractor.ts, and matching field names/shapes to how each one
// is actually used. Please diff this against your real file before
// replacing it — if your original had extra fields nothing here currently
// reads, this reconstruction will have silently dropped them.
//
// This file owns every intelligence-layer type. It does NOT import from
// pipeline/types.ts (that file only has document-stage types — RawDocument,
// CleanedDocument, SectionedDocument — which flow the other direction, into
// this layer, not out of it). nlp_pipeline.ts imports Token/POS/NamedEntity/
// NLPSentence/NLPResult FROM here (audit #9 fix) rather than the reverse, so
// there is exactly one canonical definition and no circular import.
// =============================================================================

// ─── Ontology ────────────────────────────────────────────────────────────────

/**
 * Closed set of top-level domains a concept can belong to.
 * Values are the actual strings used across cs_ontology.ts.
 */
export type OntologyDomain =
  | 'ml'
  | 'computer_vision'
  | 'nlp'
  | 'databases'
  | 'networking'
  | 'systems'
  | 'security'
  | 'algorithms';

/**
 * Edge/relation types used both for ontology-declared concept relations
 * (cs_ontology.ts) and for KnowledgeGraph edges (graph.engine.ts).
 *
 * 'mentions' — paper → concept only, used for the generic "extra entities"
 * pass in graph.engine.ts. Deliberately distinct from 'related_to' (which
 * is concept → concept only) so the two functors never collide on the same
 * arity when serialised to Prolog facts — see prolog.engine.ts and audit #5.
 */
export type RelationType =
  | 'is_a'
  | 'part_of'
  | 'uses'
  | 'solves'
  | 'related_to'
  | 'achieves'
  | 'trained_on'
  | 'mentions';

export interface OntologyRelation {
  type: RelationType;
  target: string; // concept id
}

export interface OntologyConcept {
  id: string;
  label: string;
  aliases: string[];
  /** Root-first ancestor chain, inclusive of the concept's own id */
  ancestors: string[];
  relations: OntologyRelation[];
  domain: OntologyDomain;
}

export type MatchType = 'exact' | 'alias' | 'fuzzy' | 'unknown';

export interface ResolvedConcept {
  concept: OntologyConcept;
  confidence: number;
  matchType: MatchType;
  rawInput: string;
}

// ─── Knowledge graph ───────────────────────────────────────────────────────────

export type NodeType = 'paper' | 'concept' | 'method' | 'dataset' | 'metric' | 'task';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: RelationType;
  weight: number;
}

export interface KnowledgeGraph {
  readonly nodes: Map<string, GraphNode>;
  readonly edges: GraphEdge[];
  getNode(id: string): GraphNode | undefined;
  getEdges(nodeId: string, type?: RelationType): GraphEdge[];
  getNeighbors(nodeId: string, type?: RelationType): GraphNode[];

  // ── Graph algorithms (doc component 3 — "Run Graph Algorithms") ────────────
  // Added alongside Knowledge Gap Detection + the weighted Confidence Engine.
  // All four treat the graph as undirected for traversal purposes: edge
  // direction encodes semantic meaning (paper -[uses]-> method), but "nearby
  // concepts" / "connected topics" / "important concepts" are direction-
  // agnostic questions, so traversal walks edges both ways.

  /**
   * Breadth-first walk outward from `startId` up to `maxDepth` hops.
   * Returns nodes in the order discovered, each tagged with its hop distance
   * from the start node. Mirrors the doc's "find nearby concepts" example
   * (cnn → deep_learning → ai).
   */
  bfs(startId: string, maxDepth?: number): BFSResult;

  /**
   * Unweighted shortest path between two nodes (BFS-based). Used to build
   * the doc's "explain reasoning path" output (e.g. cnn → deep_learning →
   * computer_vision). Returns null if no path exists.
   */
  shortestPath(fromId: string, toId: string): GraphPath | null;

  /**
   * Partitions the graph into connected components (undirected). Mirrors
   * the doc's "find related topics" use case — nodes that are reachable
   * from each other, regardless of the specific paper that connected them.
   */
  connectedComponents(): string[][];

  /**
   * Degree centrality per node, normalised to [0, 1] by dividing by the
   * maximum observed degree. Mirrors the doc's "determine important
   * concepts" use case (highest centrality = most important keyword).
   * Degree centrality (rather than betweenness/eigenvector) is used
   * deliberately: it's O(E), needs no iteration to converge, and for the
   * ~100-node per-paper graphs this system builds, "how many things
   * reference this concept" is a good enough proxy for importance without
   * the complexity of PageRank-style scoring.
   */
  centrality(): Map<string, number>;
}

export interface BFSResult {
  startId: string;
  /** Node id → hop distance from start (0 for the start node itself) */
  distances: Map<string, number>;
  /** Same data as distances, in discovery order — convenient for display */
  order: Array<{ id: string; depth: number }>;
}

export interface GraphPath {
  /** Node ids in order from `from` to `to`, inclusive of both endpoints */
  nodeIds: string[];
  /** Human-readable labels for the same path, for display/explanation */
  labels: string[];
  length: number; // number of hops (nodeIds.length - 1)
}

// ─── Knowledge core (output of the document pipeline) ──────────────────────────

export interface KeyPoint {
  label: string;
  value: string;
}

export interface KnowledgeExtras {
  metric: string | null;
  limitations: string | null;
  futureWork: string | null;
  topic: string | null;
  keywords: string[];
  /**
   * True once completeWithAI() (fallback/ai_fallback.service.ts) has merged
   * AI-inferred values into this KnowledgeCore. Lets downstream consumers
   * (quiz/flashcard/chat prompts, UI badges) distinguish "the symbolic
   * pipeline extracted this" from "the AI filled this in because the
   * symbolic pipeline couldn't" — the whole point of staying explainable.
   */
  aiAssisted?: boolean;
  /** Which of the strict fields were AI-filled, if aiAssisted is true */
  aiFilledFields?: ExpectedField[];
}

export interface KnowledgeCore {
  method: string | null;
  dataset: string | null;
  accuracy: number | null;
  problem: string | null;
  contributions: string[];
  keyPoints: KeyPoint[];
  /** Raw entity text list — see knowledge_extractor.ts's dedup-against-core fix */
  entities: string[];
  extras?: KnowledgeExtras;
}

// ─── NLP result ────────────────────────────────────────────────────────────────
// Canonical definitions. nlp_pipeline.ts imports these from here instead of
// redeclaring a structurally-identical parallel set (audit #9).

export interface Token {
  text: string;
  lower: string;
  pos: POS;
  isStopWord: boolean;
}

export type POS =
  | 'NN'
  | 'NNS'
  | 'NNP'
  | 'VB'
  | 'VBG'
  | 'VBN'
  | 'JJ'
  | 'RB'
  | 'IN'
  | 'DT'
  | 'CD'
  | 'SYM'
  | 'UNK';

export interface NamedEntity {
  text: string;
  type: 'ALGORITHM' | 'DATASET' | 'METRIC' | 'TOOL' | 'ORG' | 'NUMBER' | 'ACRONYM';
}

export interface NLPSentence {
  text: string;
  tokens: Token[];
  entities: NamedEntity[];
  score: number;
}

export interface NLPResult {
  sentences: NLPSentence[];
  keywords: string[];
  entities: NamedEntity[];
  topSentences: string[];
}

// ─── Knowledge Gap Detection (doc component 4) ──────────────────────────────
// Previously entirely unimplemented — no file computed "expected vs
// extracted" coverage. See gaps/gap_detector.ts.

/**
 * The core fields a well-formed paper is expected to have populated.
 * Matches KnowledgeCore's strict fields exactly (contributions/keyPoints/
 * entities are derived/aggregate, not independently "expected", so they're
 * intentionally excluded from gap scoring).
 */
export type ExpectedField = 'method' | 'dataset' | 'accuracy' | 'problem';

/**
 * The sections a well-formed academic paper is expected to have, per the
 * doc's example (Method / Dataset / Training / Evaluation / Conclusion).
 * Mapped onto SectionTitle from pipeline/types.ts — 'experiments' stands in
 * for "Training", 'results' for "Evaluation".
 */
export type ExpectedSection =
  | 'abstract'
  | 'methodology'
  | 'experiments'
  | 'results'
  | 'conclusion';

export interface KnowledgeGap {
  missingFields: ExpectedField[];
  missingSections: ExpectedSection[];
  /** Unresolved ontology entities — extracted but not recognised (matchType 'unknown') */
  unresolvedEntities: string[];
  /**
   * Fraction of expected items actually present, in [0, 1] — combines
   * fields and sections into one coverage number. 1.0 = nothing missing.
   */
  coverageScore: number;
}

// ─── Confidence Evaluation Engine (doc component 6) ─────────────────────────
// Previously `computeOverallConfidence()` only looked at ontology-resolution
// confidence (Math.min across ResolvedConcept[]). Replaced with the doc's
// weighted formula across five components. See confidence/confidence.engine.ts.

export interface ConfidenceBreakdown {
  /** Each sub-score is in [0, 1]; weights match the doc's percentages exactly */
  nlp: number; // weight 0.25
  ontology: number; // weight 0.20
  graph: number; // weight 0.20
  prolog: number; // weight 0.25
  coverage: number; // weight 0.10
  /** Weighted sum of the five scores above, in [0, 1] */
  overall: number;
  /** Same value *10, for display in the doc's "8.8/10" style */
  overallOutOf10: number;
}

// ─── AI-Assisted Completion (doc's "AI Hybrid" branch) ──────────────────────
// Fires only when needsAIFallback(confidence) is true (see
// intelligence-result.entity.ts) AND the caller supplied an AIGenerateFn —
// engine.ts never imports a concrete AI service module itself (it doesn't
// know your real ai.service.ts's import path or call signature), so the
// caller (note.service.ts) injects a thin adapter instead. This keeps
// engine.ts decoupled from provider choice/retry/timeout logic, which
// stays exactly where the roadmap already puts it: ai.service.ts.

/**
 * Minimal contract engine.ts needs from your real AI service. Bind your
 * actual `ai.service.ts`'s generate() to this shape at the call site, e.g.:
 *   runPipeline({ ..., aiGenerate: (prompt) => aiService.generate(prompt) })
 */
export type AIGenerateFn = (prompt: string) => Promise<{
  text: string;
  tokensUsed?: number;
  provider?: 'openai' | 'gemini';
}>;

/** Only the strict KnowledgeCore fields are eligible for AI completion —
 *  sections/entities are structural facts about the document, not
 *  something an AI should be asked to invent. */
export interface AIFallbackFields {
  method: string | null;
  dataset: string | null;
  accuracy: number | null;
  problem: string | null;
}

export interface AIFallbackResult {
  used: boolean;
  /** Which fields the AI actually filled (were null, AI returned non-null) */
  filledFields: ExpectedField[];
  /** Raw AI response text, kept for debugging/audit — never shown to end users as-is */
  raw?: string;
  provider?: 'openai' | 'gemini';
  tokensUsed?: number;
  /** Set when fallback was needed but no AIGenerateFn was supplied, or the AI call failed */
  skippedReason?: string;
}

// ─── Pipeline stage tracking ────────────────────────────────────────────────────

export type PipelineStage =
  | 'pending'
  | 'document'
  | 'extraction'
  | 'ontology'
  | 'graph'
  | 'prolog'
  | 'complete';

// ─── Prolog ──────────────────────────────────────────────────────────────────

export interface PrologFact {
  functor: string;
  args: string[];
}

export interface PrologAnswer {
  /** Variable name → formatted value, e.g. { X: 'cnn' } */
  bindings: Record<string, string>;
  /** Loaded facts heuristically associated with this answer's bound values */
  evidence: PrologFact[];
}

export interface PrologResult {
  goal: string;
  answers: PrologAnswer[];
  /** Human-readable reasoning chain — see prolog/explanation.ts */
  explanation: string;
  /**
   * 1.0 — direct ground-fact match
   * 0.7 — satisfied via rule inference
   * 0.4 — partially bound
   * 0.0 — no answers
   */
  confidence: number;
  resolvedBy: 'prolog' | 'fallback';
}

export interface PrologEngineInstance {
  load(graph: KnowledgeGraph, noteId: string): Promise<void>;
  query(goal: string): Promise<PrologResult>;
  queryAll(goals: string[]): Promise<PrologResult[]>;
  getFacts(): PrologFact[];
}

// ─── Top-level intelligence result ──────────────────────────────────────────────

export interface IntelligenceResult {
  noteId: string;
  stage: PipelineStage;
  nlp: NLPResult;
  core: KnowledgeCore;
  ontology: ResolvedConcept[];
  graph: KnowledgeGraph;
  prolog: {
    engine: PrologEngineInstance;
    facts: PrologFact[];
  };
  /** Knowledge Gap Detection output — see gaps/gap_detector.ts */
  gaps: KnowledgeGap;
  /** Full weighted breakdown — see confidence/confidence.engine.ts */
  confidenceBreakdown: ConfidenceBreakdown;
  /**
   * Set whenever needsAIFallback() was checked, regardless of outcome.
   * used=false with no skippedReason means confidence was high enough that
   * fallback was never attempted.
   */
  aiFallback: AIFallbackResult;
  /** Weighted overall confidence, in [0, 1] — same as confidenceBreakdown.overall.
   *  Kept as a top-level field for backwards compatibility with anything
   *  reading result.confidence directly (e.g. a future needsAIFallback()
   *  in the entity layer, per the project's "centralize thresholds"
   *  principle — this file does not itself decide a High/Low branch). */
  confidence: number;
  processedAt: Date;
}


/** Alias for compatibility with code expecting this name */
export type GapDetectionResult = KnowledgeGap;
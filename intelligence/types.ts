// src/server/intelligence/types.ts
// Canonical contracts for the evidence-grounded intelligence engine.

// ─── Ontology ────────────────────────────────────────────────────────────────

export type OntologyDomain =
  | "ml"
  | "computer_vision"
  | "nlp"
  | "databases"
  | "networking"
  | "systems"
  | "security"
  | "algorithms"
  | "software_engineering"
  | "data_science"
  | "general";

export type RelationType =
  | "is_a"
  | "part_of"
  | "uses"
  | "solves"
  | "related_to"
  | "achieves"
  | "trained_on"
  | "mentions"
  | "contains"
  | "defines"
  | "reports"
  | "evaluated_on"
  | "uses_tool"
  | "has_problem"
  | "supports"
  | "validated_by"
  | "influences";

export interface OntologyRelation {
  type: RelationType;
  target: string;
}

export interface OntologyConcept {
  id: string;
  label: string;
  aliases: string[];
  ancestors: string[];
  relations: OntologyRelation[];
  domain: OntologyDomain;
}

export type MatchType = "exact" | "alias" | "fuzzy" | "generated" | "unknown";

export interface ResolvedConcept {
  concept: OntologyConcept;
  confidence: number;
  matchType: MatchType;
  rawInput: string;
  status?: "ontology" | "document_local" | "unresolved";
}

// ─── Document profile ────────────────────────────────────────────────────────

export type DocumentKind =
  | "research_paper"
  | "lecture_notes"
  | "textbook_chapter"
  | "project_report"
  | "technical_documentation"
  | "assignment"
  | "unknown";

export type ClaimType =
  | "problem"
  | "objective"
  | "method"
  | "tool"
  | "data_source"
  | "sample"
  | "metric"
  | "result"
  | "contribution"
  | "limitation"
  | "future_work"
  | "definition";

export type FieldState = "present" | "missing" | "not_applicable";

export interface ExpectedFieldDefinition {
  field: ClaimType;
  required: boolean;
  applicable: boolean;
  reason: string;
}

export interface DocumentProfile {
  kind: DocumentKind;
  /** More specific document family when the broad kind alone is insufficient. */
  subtype?: "business_requirements_document";
  confidence: number;
  reasons: string[];
  expectedFields: ExpectedFieldDefinition[];
}

// ─── Evidence, claims and concepts ───────────────────────────────────────────

export interface EvidenceSpan {
  id: string;
  sectionId: string;
  sectionTitle: string;
  pageNumber?: number;
  chunkId?: string;
  text: string;
  startOffset?: number;
  endOffset?: number;
}

export interface ExtractedClaim {
  id: string;
  type: ClaimType;
  subject: string;
  predicate: string;
  object: string;
  metric?: string;
  numericValue?: number;
  unit?: string;
  qualifier?: string;
  evidence: EvidenceSpan[];
  extractionSource: "symbolic" | "ai";
  confidence: number;
  validationStatus?: "pending" | "valid" | "rejected";
  validationMessages?: string[];
}

export interface ConceptCandidate {
  id: string;
  term: string;
  normalizedTerm: string;
  acronym?: string;
  definition?: string;
  importance?: string;
  occurrences: number;
  sectionIds: string[];
  evidence: EvidenceSpan[];
  score: number;
  valid: boolean;
  rejectionReason?: string;
}

export interface ValidationIssue {
  code:
    | "missing_evidence"
    | "unsupported_number"
    | "metric_mismatch"
    | "duplicate_claim"
    | "invalid_concept"
    | "contradiction"
    | "missing_required_field";
  severity: "warning" | "error";
  message: string;
  claimId?: string;
  conceptId?: string;
}

export interface ValidationReport {
  validClaimIds: string[];
  rejectedClaimIds: string[];
  validConceptIds: string[];
  rejectedConceptIds: string[];
  issues: ValidationIssue[];
  groundedClaimRatio: number;
  numericClaimRatio: number;
  consistencyScore: number;
  passed: boolean;
}

// ─── Knowledge graph ─────────────────────────────────────────────────────────

export type NodeType =
  | "paper"
  | "section"
  | "concept"
  | "claim"
  | "method"
  | "dataset"
  | "metric"
  | "task"
  | "tool"
  | "sample"
  | "result"
  | "organisation";

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
  evidenceIds?: string[];
}

export interface KnowledgeGraph {
  readonly nodes: Map<string, GraphNode>;
  readonly edges: GraphEdge[];
  getNode(id: string): GraphNode | undefined;
  getEdges(nodeId: string, type?: RelationType): GraphEdge[];
  getNeighbors(nodeId: string, type?: RelationType): GraphNode[];
  bfs(startId: string, maxDepth?: number): BFSResult;
  shortestPath(fromId: string, toId: string): GraphPath | null;
  connectedComponents(): string[][];
  centrality(): Map<string, number>;
}

export interface BFSResult {
  startId: string;
  distances: Map<string, number>;
  order: Array<{ id: string; depth: number }>;
}

export interface GraphPath {
  nodeIds: string[];
  labels: string[];
  length: number;
}

// ─── Backwards-compatible knowledge core ────────────────────────────────────

export interface KeyPoint {
  label: string;
  value: string;
  claimId?: string;
  pageNumber?: number;
}

export type ExpectedField = ClaimType;

export interface KnowledgeExtras {
  metric: string | null;
  limitations: string | null;
  futureWork: string | null;
  topic: string | null;
  keywords: string[];
  aiAssisted?: boolean;
  aiFilledFields?: ExpectedField[];
}

export interface KnowledgeCore {
  // Legacy fields retained so existing feature services do not break.
  method: string | null;
  dataset: string | null;
  accuracy: number | null;
  problem: string | null;
  contributions: string[];
  keyPoints: KeyPoint[];
  entities: string[];
  extras?: KnowledgeExtras;

  // New evidence-grounded read model.
  documentProfile: DocumentProfile;
  claims: ExtractedClaim[];
  concepts: ConceptCandidate[];
  validation: ValidationReport;
  fieldStates: Partial<Record<ClaimType, FieldState>>;
}

// ─── NLP ─────────────────────────────────────────────────────────────────────

export interface Token {
  text: string;
  lower: string;
  pos: POS;
  isStopWord: boolean;
}

export type POS =
  | "NN"
  | "NNS"
  | "NNP"
  | "VB"
  | "VBG"
  | "VBN"
  | "JJ"
  | "RB"
  | "IN"
  | "DT"
  | "CD"
  | "SYM"
  | "UNK";

export interface NamedEntity {
  text: string;
  type:
    | "ALGORITHM"
    | "METHOD"
    | "DATASET"
    | "METRIC"
    | "TOOL"
    | "ORG"
    | "NUMBER"
    | "ACRONYM"
    | "CONCEPT";
}

export interface NLPSentence {
  id: string;
  text: string;
  tokens: Token[];
  entities: NamedEntity[];
  score: number;
  sectionId: string;
  sectionTitle: string;
  pageNumber?: number;
}

export interface NLPResult {
  sentences: NLPSentence[];
  keywords: string[];
  keyPhrases: string[];
  entities: NamedEntity[];
  topSentences: string[];
}

// ─── Gap detection ───────────────────────────────────────────────────────────

export type ExpectedSection =
  | "abstract"
  | "methodology"
  | "experiments"
  | "results"
  | "conclusion";

export interface KnowledgeGap {
  missingFields: ExpectedField[];
  notApplicableFields: ExpectedField[];
  structuralGaps: string[];
  domainGaps: string[];
  missingSections: ExpectedSection[];
  unresolvedEntities: string[];
  coverageScore: number;
}

// ─── Confidence ──────────────────────────────────────────────────────────────

export interface ConfidenceBreakdown {
  grounding: number;
  numericValidation: number;
  consistency: number;
  sectionCoverage: number;
  conceptQuality: number;
  ontology: number;
  graph: number;
  reasoning: number;
  overall: number;
  overallOutOf10: number;

  // Legacy aliases used by older UI/read models.
  nlp: number;
  prolog: number;
  coverage: number;
}

// ─── AI fallback ─────────────────────────────────────────────────────────────

export type AIGenerateFn = (prompt: string) => Promise<{
  text: string;
  tokensUsed?: number;
  provider?: "openai" | "gemini";
}>;

/** @deprecated Kept only for compatibility with older imports. */
export interface AIFallbackFields {
  method: string | null;
  dataset: string | null;
  accuracy: number | null;
  problem: string | null;
}

export interface AIFallbackResult {
  used: boolean;
  filledFields: ExpectedField[];
  acceptedClaimIds?: string[];
  rejectedClaims?: string[];
  raw?: string;
  provider?: "openai" | "gemini";
  tokensUsed?: number;
  skippedReason?: string;
}

// ─── User-visible processing stages ─────────────────────────────────────────

export type PipelineStage =
  | "pending"
  | "document"
  | "extraction"
  | "ontology"
  | "graph"
  | "prolog"
  | "complete";

export type IntelligenceStageId =
  | "document_received"
  | "cleaning"
  | "section_detection"
  | "document_classification"
  | "chunking"
  | "nlp"
  | "claim_extraction"
  | "claim_validation"
  | "ontology_resolution"
  | "graph_construction"
  | "symbolic_reasoning"
  | "gap_detection"
  | "confidence_scoring"
  | "ai_repair"
  | "complete";

export type IntelligenceStageStatus =
  | "pending"
  | "running"
  | "complete"
  | "partial"
  | "failed"
  | "skipped";

export interface IntelligenceStageProgress {
  stage: IntelligenceStageId;
  label: string;
  description: string;
  status: IntelligenceStageStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  message?: string;
  warnings: string[];
  metrics?: Record<string, number | string | boolean>;
}

export type PipelineProgressListener = (
  event: IntelligenceStageProgress,
) => void | Promise<void>;

// ─── Prolog ──────────────────────────────────────────────────────────────────

export interface PrologFact {
  functor: string;
  args: string[];
}

export interface PrologAnswer {
  bindings: Record<string, string>;
  evidence: PrologFact[];
}

export interface PrologResult {
  goal: string;
  answers: PrologAnswer[];
  explanation: string;
  confidence: number;
  resolvedBy: "prolog" | "fallback";
}

export interface PrologEngineInstance {
  load(graph: KnowledgeGraph, noteId: string): Promise<void>;
  query(goal: string): Promise<PrologResult>;
  queryAll(goals: string[]): Promise<PrologResult[]>;
  getFacts(): PrologFact[];
}

// ─── Final intelligence result ───────────────────────────────────────────────

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
  gaps: KnowledgeGap;
  confidenceBreakdown: ConfidenceBreakdown;
  aiFallback: AIFallbackResult;
  confidence: number;
  stageProgress: IntelligenceStageProgress[];
  processedAt: Date;
}

export type GapDetectionResult = KnowledgeGap;

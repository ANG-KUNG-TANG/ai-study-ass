// server/types/Knowledge.ts

import type {
  IntelligenceResult,
  MatchType,
  PipelineStage,
} from "@/server/intelligence/types";

export type { PipelineStage };
export type ConfidenceMode =
  | "SYMBOLIC_ONLY"
  | "SYMBOLIC_WITH_OPTIONAL_AI_POLISH"
  | "AI_REQUIRED";

export interface OntologyMatchRef {
  conceptId: string;
  confidence: number;
  matchType: MatchType;
  rawInput: string;
}

export interface GraphNodeData {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdgeData {
  from: string;
  to: string;
  type: string;
  weight: number;
  evidenceIds?: string[];
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

export type { IntelligenceResult };

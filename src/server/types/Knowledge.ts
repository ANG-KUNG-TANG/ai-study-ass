// server/types/Knowledge.ts

import type {
  IntelligenceResult,
  KnowledgeCore,
  MatchType,
  KnowledgeGap,
  ConfidenceBreakdown,
  AIFallbackResult,
  PrologFact,
  PipelineStage,
} from '@/server/intelligence/types';

export type { PipelineStage };
export type ConfidenceMode = 'SYMBOLIC_ONLY' | 'SYMBOLIC_WITH_OPTIONAL_AI_POLISH' | 'AI_REQUIRED';

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
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}


// export type CreateKnowledgeInput = Omit<KnowledgeEntity, 'createdAt' | 'updatedAt'>;

export type { IntelligenceResult };
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


export type KnowledgeTreeNodeType =
  | "root"
  | "topic"
  | "concept"
  | "term"
  | "fact";

export type KnowledgeTreeRelation =
  | "root"
  | "topic_group"
  | "explicit_hierarchy"
  | "supporting_fact";

export type KnowledgeTreeQualityStatus =
  | "passed"
  | "warning"
  | "failed";

export interface KnowledgeTreeNodeData {
  id: string;
  type: KnowledgeTreeNodeType;
  label: string;
  description: string | null;
  importance: number | null;
  sourceSectionIds: string[];
  evidenceIds: string[];
  graphNodeId: string | null;
  relationToParent: KnowledgeTreeRelation;
  relationEvidenceIds: string[];
  children: KnowledgeTreeNodeData[];
}

export interface KnowledgeTreeQuality {
  status: KnowledgeTreeQualityStatus;
  majorConceptCoverage: number;
  orphanCount: number;
  duplicateAliasCount: number;
  explicitHierarchyCount: number;
  skippedHierarchyCount: number;
  omittedUngroundedCount: number;
  maxDepth: number;
  warnings: string[];
}

export interface KnowledgeTreeData {
  root: KnowledgeTreeNodeData | null;
  quality: KnowledgeTreeQuality;
}


export type KnowledgeGraphQualityStatus =
  | "passed"
  | "warning"
  | "failed";

export interface KnowledgeGraphQuality {
  status: KnowledgeGraphQualityStatus;
  semanticNodeCount: number;
  semanticEdgeCount: number;
  semanticIsolationCount: number;
  semanticEdgeEvidenceCoverage: number;
  relationshipFactCoverage: number;
  duplicateEdgeCount: number;
  conflictingEdgeCount: number;
  skippedUnsafeRelationshipCount: number;
  omittedUngroundedNodeCount: number;
  warnings: string[];
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

export type { IntelligenceResult };

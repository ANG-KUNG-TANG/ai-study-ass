import type { Edge, Node } from "@xyflow/react";

export type KnowledgeStatus =
  | "not_generated"
  | "ready"
  | "partial"
  | "failed";

export type KnowledgeTab = "graph" | "concepts" | "evidence";
export type GraphDirection = "LR" | "TB";

export interface KnowledgeGraphNode {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
  evidenceIds?: string[];
}

export interface KnowledgeResponse {
  noteId: string;
  stage: string;
  status: KnowledgeStatus;
  mode: string | null;
  error?: string;
  confidence?: number;
  graph?: {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  };
  core?: {
    method?: string | null;
    dataset?: string | null;
    accuracy?: number | null;
    problem?: string | null;
    contributions?: string[];
    entities?: string[];
    keyPoints?: Array<{ label: string; value: string }>;
  };
  ontologyMatches?: unknown[];
  prologFacts?: unknown[];
}

export interface EvidenceItem {
  id: string;
  text: string;
  pageNumber?: number;
  sectionTitle?: string;
  sectionId?: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  confidence?: number;
}

export interface KnowledgeNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  description: string;
  confidence?: number;
  connectionCount: number;
  properties: Record<string, unknown>;
  evidence: EvidenceItem[];
  dimmed?: boolean;
}

export type KnowledgeFlowNode = Node<KnowledgeNodeData, "knowledge">;
export type KnowledgeFlowEdge = Edge<{
  relationType: string;
  weight: number;
  evidenceIds: string[];
}>;

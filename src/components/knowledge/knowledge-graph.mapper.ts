import { MarkerType } from "@xyflow/react";
import type {
  KnowledgeFlowEdge,
  KnowledgeFlowNode,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./types";
import {
  connectionCountByNode,
  edgeColor,
  extractNodeEvidence,
  getNodeDescription,
  nodeConfidence,
  relationLabel,
} from "./knowledge-graph.utils";

export function mapKnowledgeGraph(
  apiNodes: KnowledgeGraphNode[],
  apiEdges: KnowledgeGraphEdge[],
  selectedNodeId: string | null,
): { nodes: KnowledgeFlowNode[]; edges: KnowledgeFlowEdge[] } {
  const connectionCounts = connectionCountByNode(apiEdges);
  const neighborIds = new Set<string>();

  if (selectedNodeId) {
    neighborIds.add(selectedNodeId);
    for (const edge of apiEdges) {
      if (edge.from === selectedNodeId) neighborIds.add(edge.to);
      if (edge.to === selectedNodeId) neighborIds.add(edge.from);
    }
  }

  const nodes: KnowledgeFlowNode[] = apiNodes.map((node) => ({
    id: node.id,
    type: "knowledge",
    position: { x: 0, y: 0 },
    selected: node.id === selectedNodeId,
    data: {
      label: node.label || "Unnamed concept",
      nodeType: node.type || "concept",
      description: getNodeDescription(node),
      confidence: nodeConfidence(node),
      connectionCount: connectionCounts.get(node.id) ?? 0,
      properties: node.properties ?? {},
      evidence: extractNodeEvidence(node),
      dimmed: Boolean(selectedNodeId && !neighborIds.has(node.id)),
    },
  }));

  const edges: KnowledgeFlowEdge[] = apiEdges.map((edge, index) => {
    const relatedToSelection =
      !selectedNodeId || edge.from === selectedNodeId || edge.to === selectedNodeId;
    const stroke = edgeColor(edge.type);

    return {
      id: `${edge.from}-${edge.type}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: relationLabel(edge.type),
      animated: Boolean(selectedNodeId && relatedToSelection),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 16,
        height: 16,
      },
      style: {
        stroke,
        strokeWidth: 1.25 + Math.max(0, Math.min(1, edge.weight ?? 0)) * 1.8,
        opacity: relatedToSelection ? 0.9 : 0.13,
        transition: "opacity 160ms ease",
      },
      labelStyle: {
        fill: relatedToSelection ? "#514B40" : "#A79F90",
        fontSize: 10,
        fontWeight: 600,
      },
      labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.92 },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 5,
      data: {
        relationType: edge.type,
        weight: edge.weight,
        evidenceIds: edge.evidenceIds ?? [],
      },
    };
  });

  return { nodes, edges };
}

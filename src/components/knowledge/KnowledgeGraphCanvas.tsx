"use client";

import { useMemo, useState } from "react";
import { Columns3, Maximize2, RotateCcw, Rows3 } from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { KnowledgeNode } from "./KnowledgeNode";
import { layoutKnowledgeGraph } from "./knowledge-graph.layout";
import { mapKnowledgeGraph } from "./knowledge-graph.mapper";
import { nodeColor } from "./knowledge-graph.utils";
import type { GraphDirection, KnowledgeGraphEdge, KnowledgeGraphNode } from "./types";
import { useLanguage } from "@/context/LanguageContext";

const nodeTypes: NodeTypes = { knowledge: KnowledgeNode };

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

function KnowledgeGraphCanvasInner({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: KnowledgeGraphCanvasProps) {
  const { t } = useLanguage();
  const [direction, setDirection] = useState<GraphDirection>("LR");
  const { fitView } = useReactFlow();

  const mapped = useMemo(
    () => mapKnowledgeGraph(nodes, edges, selectedNodeId),
    [nodes, edges, selectedNodeId],
  );
  const laidOut = useMemo(
    () => layoutKnowledgeGraph(mapped.nodes, mapped.edges, direction),
    [mapped, direction],
  );

  function fitGraph() {
    void fitView({ padding: 0.16, duration: 350, maxZoom: 1.25 });
  }

  function resetLayout() {
    setDirection("LR");
    requestAnimationFrame(fitGraph);
  }

  function toggleDirection() {
    setDirection((current) => (current === "LR" ? "TB" : "LR"));
    requestAnimationFrame(fitGraph);
  }

  return (
    <div className="knowledge-flow h-[640px] w-full overflow-hidden rounded-[10px] border border-line bg-paper-raised">
      <ReactFlow
        nodes={laidOut.nodes}
        edges={laidOut.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.25 }}
        minZoom={0.18}
        maxZoom={2.2}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#E9E2D2" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(node) => nodeColor(String(node.data?.nodeType ?? "concept"))}
          nodeStrokeWidth={2}
          maskColor="rgba(250, 246, 236, 0.72)"
          className="!border !border-line !bg-paper-raised"
        />
        <Panel position="top-right">
          <div className="flex items-center gap-2 rounded-[8px] border border-line bg-paper-raised/95 p-1.5 backdrop-blur">
            <button type="button" onClick={fitGraph}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-ink-soft hover:bg-line-soft">
              <Maximize2 size={14} /> {t("knowledge.fitGraph")}
            </button>
            <button type="button" onClick={toggleDirection}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-ink-soft hover:bg-line-soft">
              {direction === "LR" ? <Columns3 size={14} /> : <Rows3 size={14} />}
              {direction}
            </button>
            <button type="button" onClick={resetLayout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-ink-soft hover:bg-line-soft">
              <RotateCcw size={14} /> {t("knowledge.resetGraph")}
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function KnowledgeGraphCanvas(props: KnowledgeGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

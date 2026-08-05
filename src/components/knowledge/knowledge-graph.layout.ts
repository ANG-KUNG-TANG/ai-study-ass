import type { GraphDirection, KnowledgeFlowEdge, KnowledgeFlowNode } from "./types";

const NODE_WIDTH = 228;
const NODE_HEIGHT = 96;
const HORIZONTAL_GAP = 92;
const VERTICAL_GAP = 42;

/**
 * Deterministic layered layout for document knowledge graphs.
 * It keeps the document/root node first, assigns outgoing neighbors to later
 * levels, and places disconnected ontology context after the connected graph.
 */
export function layoutKnowledgeGraph(
  nodes: KnowledgeFlowNode[],
  edges: KnowledgeFlowEdge[],
  direction: GraphDirection,
): { nodes: KnowledgeFlowNode[]; edges: KnowledgeFlowEdge[] } {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  const paperRoots = nodes.filter((node) => node.data.nodeType === "paper").map((node) => node.id);
  const roots = paperRoots.length > 0
    ? paperRoots
    : nodes.filter((node) => (incomingCount.get(node.id) ?? 0) === 0).map((node) => node.id);

  if (roots.length === 0 && nodes[0]) roots.push(nodes[0].id);

  const levels = new Map<string, number>();
  const queue = roots.map((id) => ({ id, level: 0 }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const existing = levels.get(current.id);
    if (existing !== undefined && existing <= current.level) continue;
    levels.set(current.id, current.level);

    for (const target of outgoing.get(current.id) ?? []) {
      queue.push({ id: target, level: current.level + 1 });
    }
  }

  let nextDisconnectedLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, nextDisconnectedLevel);
      nextDisconnectedLevel += 1;
    }
  }

  const groups = new Map<number, KnowledgeFlowNode[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    groups.set(level, [...(groups.get(level) ?? []), node]);
  }

  const positioned = new Map<string, { x: number; y: number }>();
  for (const [level, group] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    const breadth = group.length * NODE_HEIGHT + Math.max(0, group.length - 1) * VERTICAL_GAP;

    group
      .sort((a, b) => a.data.label.localeCompare(b.data.label))
      .forEach((node, index) => {
        const breadthOffset = index * (NODE_HEIGHT + VERTICAL_GAP) - breadth / 2;
        const depthOffset = level * (NODE_WIDTH + HORIZONTAL_GAP);

        positioned.set(
          node.id,
          direction === "LR"
            ? { x: depthOffset, y: breadthOffset }
            : { x: breadthOffset, y: depthOffset },
        );
      });
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: positioned.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges: edges.map((edge) => ({
      ...edge,
      sourceHandle: direction === "LR" ? "source-right" : "source-bottom",
      targetHandle: direction === "LR" ? "target-left" : "target-top",
    })),
  };
}

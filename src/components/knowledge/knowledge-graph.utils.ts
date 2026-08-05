import type {
  EvidenceItem,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./types";

export function readableType(type: string): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function nodeConfidence(node: KnowledgeGraphNode): number | undefined {
  const properties = node.properties ?? {};
  return asNumber(properties.confidence) ?? asNumber(properties.score);
}

export function getNodeDescription(node: KnowledgeGraphNode): string {
  const properties = node.properties ?? {};
  const candidates = [
    properties.description,
    properties.definition,
    properties.summary,
    properties.explanation,
    properties.subject,
  ];

  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value) return value;
  }

  if (node.type === "claim" || node.type === "result") return node.label;
  return `${readableType(node.type)} extracted from the uploaded document.`;
}

function normaliseEvidence(
  value: unknown,
  node: KnowledgeGraphNode,
  index: number,
): EvidenceItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const text = asString(raw.text) ?? asString(raw.evidenceText);
  if (!text) return null;

  return {
    id: asString(raw.id) ?? `${node.id}-evidence-${index + 1}`,
    text,
    pageNumber: asNumber(raw.pageNumber),
    sectionTitle: asString(raw.sectionTitle),
    sectionId: asString(raw.sectionId),
    nodeId: node.id,
    nodeLabel: node.label,
    nodeType: node.type,
    confidence: nodeConfidence(node),
  };
}

export function extractNodeEvidence(node: KnowledgeGraphNode): EvidenceItem[] {
  const rawEvidence = node.properties?.evidence;
  if (!Array.isArray(rawEvidence)) return [];

  return rawEvidence
    .map((value, index) => normaliseEvidence(value, node, index))
    .filter((item): item is EvidenceItem => item !== null);
}

export function collectEvidence(nodes: KnowledgeGraphNode[]): EvidenceItem[] {
  const seen = new Set<string>();
  return nodes.flatMap(extractNodeEvidence).filter((item) => {
    const key = item.id || `${item.nodeId}:${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function connectionCountByNode(edges: KnowledgeGraphEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
    counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
  }
  return counts;
}

export function relationLabel(type: string): string {
  return type.replaceAll("_", " ").toLowerCase();
}

export function edgeColor(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("uses") || lower.includes("implement")) return "#E5A229";
  if (lower.includes("result") || lower.includes("report") || lower.includes("achieve")) return "#35A86B";
  if (lower.includes("evaluate") || lower.includes("dataset")) return "#E05A9D";
  if (lower.includes("is_a") || lower.includes("related")) return "#8B7DD6";
  if (lower.includes("support") || lower.includes("define")) return "#2F86C9";
  return "#7C8EA3";
}

export function nodeColor(type: string): string {
  switch (type) {
    case "paper": return "#4D7DF3";
    case "concept": return "#825ED3";
    case "method": return "#E5A229";
    case "tool": return "#2F86C9";
    case "dataset": return "#E05A9D";
    case "result": return "#35A86B";
    case "metric": return "#6E54C9";
    case "sample": return "#2FA9A2";
    case "claim": return "#E06D55";
    default: return "#7C8EA3";
  }
}

export function formatProperty(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return JSON.stringify(value);
}

import type {
  BFSResult,
  GraphEdge,
  GraphNode,
  GraphPath,
  KnowledgeCore,
  KnowledgeGraph,
  OntologyConcept,
  RelationType,
  ResolvedConcept,
} from "../types";

interface OntologyResolver {
  resolve(raw: string): ResolvedConcept;
  getById(id: string): OntologyConcept | undefined;
  getRelations(id: string): Array<{ type: RelationType; target: string }>;
  getAncestors(id: string): string[];
}

class InMemoryKnowledgeGraph implements KnowledgeGraph {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges: GraphEdge[] = [];
  private readonly edgeKeys = new Set<string>();

  addNode(node: GraphNode): void {
    const existing = this.nodes.get(node.id);
    if (!existing) {
      this.nodes.set(node.id, node);
      return;
    }
    this.nodes.set(node.id, {
      ...existing,
      ...node,
      properties: { ...(existing.properties ?? {}), ...(node.properties ?? {}) },
    });
  }

  addEdge(edge: GraphEdge): void {
    const key = `${edge.from}|${edge.type}|${edge.to}`;
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);
    this.edges.push(edge);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(nodeId: string, type?: RelationType): GraphEdge[] {
    return this.edges.filter(
      (edge) => (edge.from === nodeId || edge.to === nodeId) && (!type || edge.type === type),
    );
  }

  getNeighbors(nodeId: string, type?: RelationType): GraphNode[] {
    const ids = new Set<string>();
    for (const edge of this.getEdges(nodeId, type)) {
      ids.add(edge.from === nodeId ? edge.to : edge.from);
    }
    return [...ids].map((id) => this.nodes.get(id)).filter((node): node is GraphNode => Boolean(node));
  }

  bfs(startId: string, maxDepth = Number.POSITIVE_INFINITY): BFSResult {
    const distances = new Map<string, number>();
    const order: Array<{ id: string; depth: number }> = [];
    if (!this.nodes.has(startId)) return { startId, distances, order };

    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    distances.set(startId, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      if (current.depth >= maxDepth) continue;
      for (const neighbor of this.getNeighbors(current.id)) {
        if (distances.has(neighbor.id)) continue;
        const depth = current.depth + 1;
        distances.set(neighbor.id, depth);
        queue.push({ id: neighbor.id, depth });
      }
    }

    return { startId, distances, order };
  }

  shortestPath(fromId: string, toId: string): GraphPath | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    const queue = [fromId];
    const parent = new Map<string, string | null>([[fromId, null]]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === toId) break;
      for (const neighbor of this.getNeighbors(current)) {
        if (parent.has(neighbor.id)) continue;
        parent.set(neighbor.id, current);
        queue.push(neighbor.id);
      }
    }

    if (!parent.has(toId)) return null;
    const nodeIds: string[] = [];
    let cursor: string | null = toId;
    while (cursor) {
      nodeIds.push(cursor);
      cursor = parent.get(cursor) ?? null;
    }
    nodeIds.reverse();
    return {
      nodeIds,
      labels: nodeIds.map((id) => this.nodes.get(id)?.label ?? id),
      length: nodeIds.length - 1,
    };
  }

  connectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    for (const id of this.nodes.keys()) {
      if (visited.has(id)) continue;
      const component = this.bfs(id).order.map((item) => item.id);
      component.forEach((nodeId) => visited.add(nodeId));
      components.push(component);
    }
    return components;
  }

  centrality(): Map<string, number> {
    const degrees = new Map<string, number>();
    let max = 0;
    for (const id of this.nodes.keys()) {
      const degree = this.getEdges(id).length;
      degrees.set(id, degree);
      max = Math.max(max, degree);
    }
    return new Map([...degrees.entries()].map(([id, degree]) => [id, max === 0 ? 0 : degree / max]));
  }
}

export function buildGraph(
  core: KnowledgeCore,
  ontology: OntologyResolver,
  noteId: string,
): KnowledgeGraph {
  const graph = new InMemoryKnowledgeGraph();
  const paperId = `paper:${noteId}`;
  graph.addNode({
    id: paperId,
    type: "paper",
    label: core.extras?.topic ?? "Document",
    properties: {
      noteId,
      documentKind: core.documentProfile.kind,
      confidence: core.validation.groundedClaimRatio,
    },
  });

  for (const claim of core.claims.filter((item) => item.validationStatus === "valid")) {
    const claimId = `claim:${claim.id}`;
    const nodeType = claim.type === "result" ? "result" : "claim";
    graph.addNode({
      id: claimId,
      type: nodeType,
      label: claim.object,
      properties: {
        claimType: claim.type,
        subject: claim.subject,
        predicate: claim.predicate,
        metric: claim.metric,
        numericValue: claim.numericValue,
        unit: claim.unit,
        confidence: claim.confidence,
        evidence: claim.evidence,
      },
    });

    graph.addEdge({
      from: paperId,
      to: claimId,
      type: relationForClaim(claim.type),
      weight: claim.confidence,
      evidenceIds: claim.evidence.map((evidence) => evidence.id),
    });

    if (["method", "tool", "data_source", "sample", "metric"].includes(claim.type)) {
      const typedNode = makeTypedNode(claim.type, claim.object, claim.numericValue, claim.metric);
      graph.addNode(typedNode);
      graph.addEdge({
        from: paperId,
        to: typedNode.id,
        type: typedRelationForClaim(claim.type),
        weight: claim.confidence,
        evidenceIds: claim.evidence.map((evidence) => evidence.id),
      });
      graph.addEdge({
        from: claimId,
        to: typedNode.id,
        type: "supports",
        weight: claim.confidence,
        evidenceIds: claim.evidence.map((evidence) => evidence.id),
      });
    }
  }

  for (const concept of core.concepts.filter((item) => item.valid).slice(0, 30)) {
    const resolution = ontology.resolve(concept.term);
    const conceptId = resolution.matchType === "unknown"
      ? `concept:local-${slugify(concept.normalizedTerm)}`
      : `concept:${resolution.concept.id}`;
    graph.addNode({
      id: conceptId,
      type: "concept",
      label: resolution.matchType === "unknown" ? concept.term : resolution.concept.label,
      properties: {
        status: resolution.matchType === "unknown" ? "document_local" : "ontology",
        occurrences: concept.occurrences,
        score: concept.score,
        rawInput: concept.term,
      },
    });
    graph.addEdge({
      from: paperId,
      to: conceptId,
      type: "mentions",
      weight: concept.score,
      evidenceIds: concept.evidence.map((evidence) => evidence.id),
    });

    if (resolution.matchType !== "unknown") {
      addOntologyContext(graph, resolution.concept.id, ontology, new Set());
    }
  }

  return graph;
}

function addOntologyContext(
  graph: InMemoryKnowledgeGraph,
  conceptId: string,
  ontology: OntologyResolver,
  visited: Set<string>,
): void {
  if (visited.has(conceptId)) return;
  visited.add(conceptId);
  const concept = ontology.getById(conceptId);
  if (!concept) return;

  const sourceId = `concept:${concept.id}`;
  graph.addNode({ id: sourceId, type: "concept", label: concept.label, properties: { domain: concept.domain } });

  for (const relation of ontology.getRelations(conceptId)) {
    const target = ontology.getById(relation.target);
    if (!target) continue;
    const targetId = `concept:${target.id}`;
    graph.addNode({ id: targetId, type: "concept", label: target.label, properties: { domain: target.domain } });
    graph.addEdge({ from: sourceId, to: targetId, type: relation.type, weight: 0.7 });
  }

  const ancestors = ontology.getAncestors(conceptId);
  for (let index = 0; index < ancestors.length - 1; index += 1) {
    const child = ontology.getById(ancestors[index + 1]);
    const parent = ontology.getById(ancestors[index]);
    if (!child || !parent || child.id === parent.id) continue;
    graph.addNode({ id: `concept:${child.id}`, type: "concept", label: child.label });
    graph.addNode({ id: `concept:${parent.id}`, type: "concept", label: parent.label });
    graph.addEdge({ from: `concept:${child.id}`, to: `concept:${parent.id}`, type: "is_a", weight: 0.85 });
  }
}

function relationForClaim(type: KnowledgeCore["claims"][number]["type"]): RelationType {
  switch (type) {
    case "method": return "uses";
    case "tool": return "uses_tool";
    case "sample":
    case "data_source": return "evaluated_on";
    case "problem": return "has_problem";
    case "definition": return "defines";
    case "result":
    case "metric": return "reports";
    default: return "contains";
  }
}

function typedRelationForClaim(type: string): RelationType {
  if (type === "method") return "uses";
  if (type === "tool") return "uses_tool";
  if (type === "data_source" || type === "sample") return "evaluated_on";
  if (type === "metric") return "reports";
  return "mentions";
}

function makeTypedNode(
  type: string,
  value: string,
  numericValue?: number,
  metric?: string,
): GraphNode {
  const slug = slugify(value);
  if (type === "method") return { id: `method:${slug}`, type: "method", label: value };
  if (type === "tool") return { id: `tool:${slug}`, type: "tool", label: value };
  if (type === "data_source") return { id: `dataset:${slug}`, type: "dataset", label: value };
  if (type === "sample") return { id: `sample:${slug}`, type: "sample", label: value, properties: { value: numericValue } };
  return { id: `metric:${slug}`, type: "metric", label: value, properties: { value: numericValue, metric } };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 90);
}

export { InMemoryKnowledgeGraph };

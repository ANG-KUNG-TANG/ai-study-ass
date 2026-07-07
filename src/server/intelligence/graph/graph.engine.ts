import type {
  BFSResult,
  GraphEdge,
  GraphNode,
  GraphPath,
  KnowledgeCore,
  KnowledgeGraph,
  NodeType,
  RelationType,
} from '../types';
import { ontologyCache } from '../ontology/ontology.cache';

// Derive the cache type from the singleton — the class itself is not exported
type OntologyCache = typeof ontologyCache;

// ─── Node id convention ────────────────────────────────────────────────────────
// Prefixed by type so ids never collide across different node types.
//
//   paper:{noteId}          e.g. 'paper:note_abc123'
//   concept:{conceptId}     e.g. 'concept:cnn'
//   dataset:{conceptId}     e.g. 'dataset:cifar10'
//   method:{conceptId}      e.g. 'method:cnn'
//   metric:accuracy         (singleton — one per graph)
//   task:{conceptId}        e.g. 'task:image_classification'

function nodeId(type: NodeType, id: string): string {
  return `${type}:${id}`;
}

// ─── KnowledgeGraphImpl ────────────────────────────────────────────────────────
// Concrete implementation of the KnowledgeGraph interface.
// Edges are stored flat; adjacency is built on-demand via filter.
// For ~100-node graphs this is fast enough and keeps the structure simple.

class KnowledgeGraphImpl implements KnowledgeGraph {
  readonly nodes: Map<string, GraphNode> = new Map();
  readonly edges: GraphEdge[] = [];

  // ── Mutation helpers (used only during build) ────────────────────────────

  addNode(node: GraphNode): void {
    // Idempotent — if the node already exists, keep the first version.
    // Ancestor walks can produce duplicate concept nodes; silently skip them.
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  addEdge(edge: GraphEdge): void {
    // Deduplicate: same (from, to, type) triple is only stored once.
    const exists = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type,
    );
    if (!exists) {
      this.edges.push(edge);
    }
  }

  // ── Query interface (KnowledgeGraph contract) ────────────────────────────

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(nodeId: string, type?: RelationType): GraphEdge[] {
    return this.edges.filter(
      (e) =>
        (e.from === nodeId || e.to === nodeId) &&
        (type === undefined || e.type === type),
    );
  }

  getNeighbors(nodeId: string, type?: RelationType): GraphNode[] {
    const edges = this.getEdges(nodeId, type);
    const neighborIds = edges.map((e) =>
      e.from === nodeId ? e.to : e.from,
    );
    const seen = new Set<string>();
    const neighbors: GraphNode[] = [];
    for (const id of neighborIds) {
      if (!seen.has(id)) {
        seen.add(id);
        const node = this.nodes.get(id);
        if (node) neighbors.push(node);
      }
    }
    return neighbors;
  }

  // ── Graph algorithms (doc component 3) ───────────────────────────────────
  // Previously unimplemented — getNode/getEdges/getNeighbors only gave
  // one-hop adjacency, not traversal or ranking. All four algorithms below
  // build a plain undirected adjacency list once per call and operate on
  // that, rather than repeatedly calling getEdges() (which is O(E) per
  // call) — for ~100-node graphs this keeps each algorithm O(V + E) instead
  // of O(V * E).

  private buildAdjacency(): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    const ensure = (id: string) => {
      if (!adj.has(id)) adj.set(id, new Set());
    };
    for (const id of this.nodes.keys()) ensure(id);
    for (const edge of this.edges) {
      ensure(edge.from);
      ensure(edge.to);
      adj.get(edge.from)!.add(edge.to);
      adj.get(edge.to)!.add(edge.from);
    }
    return adj;
  }

  bfs(startId: string, maxDepth = Infinity): BFSResult {
    const distances = new Map<string, number>();
    const order: Array<{ id: string; depth: number }> = [];

    if (!this.nodes.has(startId)) {
      return { startId, distances, order };
    }

    const adj = this.buildAdjacency();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    distances.set(startId, 0);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      order.push({ id, depth });
      if (depth >= maxDepth) continue;

      for (const neighborId of adj.get(id) ?? []) {
        if (!distances.has(neighborId)) {
          distances.set(neighborId, depth + 1);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }

    return { startId, distances, order };
  }

  shortestPath(fromId: string, toId: string): GraphPath | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) {
      const label = this.nodes.get(fromId)?.label ?? fromId;
      return { nodeIds: [fromId], labels: [label], length: 0 };
    }

    const adj = this.buildAdjacency();
    const prev = new Map<string, string>();
    const visited = new Set<string>([fromId]);
    const queue: string[] = [fromId];

    let found = false;
    while (queue.length > 0 && !found) {
      const current = queue.shift()!;
      for (const neighborId of adj.get(current) ?? []) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        prev.set(neighborId, current);
        if (neighborId === toId) {
          found = true;
          break;
        }
        queue.push(neighborId);
      }
    }

    if (!found) return null;

    // Walk parent pointers back from toId to fromId, then reverse.
    const nodeIds: string[] = [toId];
    let cursor = toId;
    while (cursor !== fromId) {
      cursor = prev.get(cursor)!;
      nodeIds.push(cursor);
    }
    nodeIds.reverse();

    const labels = nodeIds.map((id) => this.nodes.get(id)?.label ?? id);
    return { nodeIds, labels, length: nodeIds.length - 1 };
  }

  connectedComponents(): string[][] {
    const adj = this.buildAdjacency();
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const startId of this.nodes.keys()) {
      if (visited.has(startId)) continue;

      const component: string[] = [];
      const queue: string[] = [startId];
      visited.add(startId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        for (const neighborId of adj.get(current) ?? []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  centrality(): Map<string, number> {
    const degree = new Map<string, number>();
    for (const id of this.nodes.keys()) degree.set(id, 0);

    for (const edge of this.edges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }

    const maxDegree = Math.max(1, ...degree.values()); // avoid divide-by-zero on an edgeless graph
    const normalised = new Map<string, number>();
    for (const [id, d] of degree) {
      normalised.set(id, d / maxDegree);
    }
    return normalised;
  }
}

// ─── buildGraph ────────────────────────────────────────────────────────────────
// Main export. Converts KnowledgeCore + OntologyCache → KnowledgeGraph.
//
// Build order (mirrors design doc §graph.engine.ts):
//   1. Paper node
//   2. Method node  → 'uses' edge to paper
//   3. Dataset node → 'trained_on' edge from paper
//   4. Accuracy     → metric node + 'achieves' edge from paper
//   5. Problem      → task node + 'solves' edge from paper
//   6. Ancestor walk for every resolved concept → ancestor nodes + 'is_a' edges
//   7. Ontology relations for every resolved concept → inferred edges (weight 0.7)

export function buildGraph(
  core: KnowledgeCore,
  cache: OntologyCache,
  noteId: string,
): KnowledgeGraph {
  const graph = new KnowledgeGraphImpl();
  const paperId = nodeId('paper', noteId);

  // ── 1. Paper node ──────────────────────────────────────────────────────────
  graph.addNode({
    id: paperId,
    type: 'paper',
    label: `Note: ${noteId}`,
    properties: { noteId },
  });

  // ── 2. Method ──────────────────────────────────────────────────────────────
  // FIX (audit #2 — critical): previously had no 'unknown' guard, unlike the
  // core.entities loop below. An unresolved method produces
  // concept.id = 'unknown:some_raw_text', which becomes node id
  // 'method:unknown:some_raw_text'. stripPrefix() in prolog.engine.ts only
  // strips up to the *first* ':', so the "slug" stays 'unknown:some_raw_text'
  // — and ':' is a Prolog infix operator, so method(note1, unknown:x). parses
  // as a compound term, not the intended atom. extractMethod()'s fallback
  // (first capitalised phrase when no ALGORITHM entity is found) makes an
  // unresolved method a common case, not a rare edge case.
  if (core.method !== null && cache.resolve(core.method).matchType !== 'unknown') {
    const resolved = cache.resolve(core.method);
    const concept = resolved.concept;
    const mId = nodeId('method', concept.id);

    graph.addNode({
      id: mId,
      type: 'method',
      label: concept.label,
      properties: {
        conceptId: concept.id,
        domain: concept.domain,
        confidence: resolved.confidence,
        matchType: resolved.matchType,
      },
    });

    // paper -[uses]-> method  (explicit, weight 1.0)
    graph.addEdge({ from: paperId, to: mId, type: 'uses', weight: 1.0 });

    // Walk ancestors + ontology relations for the method concept
    addAncestorChain(graph, concept.id, cache);
    addOntologyRelations(graph, concept.id, cache);

    // FIX (discovered while implementing shortestPath/BFS): method:cnn and
    // concept:cnn were previously two disconnected nodes for the same
    // underlying concept — addAncestorChain() adds a concept:cnn node (the
    // ancestors array is inclusive of the concept's own id), but nothing
    // ever linked the role-specific method:cnn node to it. Traversal
    // between a method and its own ontology ancestors (e.g. the doc's
    // "explain reasoning path: cnn → deep_learning → computer_vision"
    // example) had to route through the paper node instead, producing a
    // longer, less meaningful path. This edge is self-referential once
    // stripped to a Prolog slug (method:cnn and concept:cnn both slug to
    // 'cnn'), so prolog.engine.ts's existing self-loop guard
    // (`if (fromSlug === toSlug) continue`) already drops it from the
    // generated facts — it exists purely for in-memory graph traversal.
    graph.addEdge({ from: mId, to: nodeId('concept', concept.id), type: 'is_a', weight: 1.0 });
  }

  // ── 3. Dataset ─────────────────────────────────────────────────────────────
  // FIX (audit #2): same unknown-match guard as method above.
  if (core.dataset !== null && cache.resolve(core.dataset).matchType !== 'unknown') {
    const resolved = cache.resolve(core.dataset);
    const concept = resolved.concept;
    const dId = nodeId('dataset', concept.id);

    graph.addNode({
      id: dId,
      type: 'dataset',
      label: concept.label,
      properties: {
        conceptId: concept.id,
        domain: concept.domain,
        confidence: resolved.confidence,
        matchType: resolved.matchType,
      },
    });

    // paper -[trained_on]-> dataset  (explicit, weight 1.0)
    graph.addEdge({ from: paperId, to: dId, type: 'trained_on', weight: 1.0 });

    addAncestorChain(graph, concept.id, cache);
    addOntologyRelations(graph, concept.id, cache);

    // Same fix as the method node above — link dataset:X to concept:X.
    graph.addEdge({ from: dId, to: nodeId('concept', concept.id), type: 'is_a', weight: 1.0 });
  }

  // ── 4. Accuracy (metric) ───────────────────────────────────────────────────
  if (core.accuracy !== null) {
    const metricId = nodeId('metric', 'accuracy');

    graph.addNode({
      id: metricId,
      type: 'metric',
      label: 'Accuracy',
      properties: { value: core.accuracy, unit: '%' },
    });

    // paper -[achieves]-> metric  (explicit, weight 1.0)
    graph.addEdge({ from: paperId, to: metricId, type: 'achieves', weight: 1.0 });
  }

  // ── 5. Problem (task) ──────────────────────────────────────────────────────
  // FIX (audit #2): same unknown-match guard as method/dataset above.
  if (core.problem !== null && cache.resolve(core.problem).matchType !== 'unknown') {
    const resolved = cache.resolve(core.problem);
    const concept = resolved.concept;
    const tId = nodeId('task', concept.id);

    graph.addNode({
      id: tId,
      type: 'task',
      label: concept.label,
      properties: {
        conceptId: concept.id,
        confidence: resolved.confidence,
        matchType: resolved.matchType,
      },
    });

    // paper -[solves]-> task  (explicit, weight 1.0)
    graph.addEdge({ from: paperId, to: tId, type: 'solves', weight: 1.0 });

    addAncestorChain(graph, concept.id, cache);
    addOntologyRelations(graph, concept.id, cache);

    // Same fix as the method node above — link task:X to concept:X.
    graph.addEdge({ from: tId, to: nodeId('concept', concept.id), type: 'is_a', weight: 1.0 });
  }

  // ── 6 + 7. Extra entities from KnowledgeCore ──────────────────────────────
  // Any entity that wasn't already covered by method/dataset/problem above.
  // These arrive as raw strings and get resolved → concept nodes.
  for (const raw of core.entities) {
    const resolved = cache.resolve(raw);
    if (resolved.matchType === 'unknown') continue; // skip unrecognised terms

    const concept = resolved.concept;
    const cId = nodeId('concept', concept.id);

    graph.addNode({
      id: cId,
      type: 'concept',
      label: concept.label,
      properties: {
        conceptId: concept.id,
        domain: concept.domain,
        confidence: resolved.confidence,
        matchType: resolved.matchType,
      },
    });

    // paper -[mentions]-> concept  (inferred, weight 0.7)
    // FIX (audit #5): renamed from 'related_to' — that type is also used for
    // concept-to-concept ontology relations a few lines below in
    // addOntologyRelations(), and both would otherwise serialise to the same
    // Prolog functor/arity (related_to/2), making paper-mentions-concept and
    // concept-relates-to-concept facts indistinguishable to any rule or query
    // that enumerates related_to/2 generically. See types.ts's RelationType.
    graph.addEdge({ from: paperId, to: cId, type: 'mentions', weight: 0.7 });

    addAncestorChain(graph, concept.id, cache);
    addOntologyRelations(graph, concept.id, cache);
  }

  return graph;
}

// ─── Ancestor chain helper ─────────────────────────────────────────────────────
// Walks concept.ancestors (pre-computed root-first array) and adds:
//   - A concept node for each ancestor that exists in the cache
//   - An 'is_a' edge from each ancestor to the next one in the chain
//
// Ancestors array example for 'cnn': ['ai', 'ml', 'deep_learning', 'cnn']
// Produces edges: ai→ml, ml→deep_learning, deep_learning→cnn  (is_a, weight 0.7)

function addAncestorChain(
  graph: KnowledgeGraphImpl,
  conceptId: string,
  cache: OntologyCache,
): void {
  const ancestors = cache.getAncestors(conceptId);

  for (let i = 0; i < ancestors.length; i++) {
    const ancestorId = ancestors[i]!;
    const ancestorConcept = cache.getById(ancestorId);

    // Add ancestor as a concept node (may already exist — addNode is idempotent)
    if (ancestorConcept) {
      graph.addNode({
        id: nodeId('concept', ancestorId),
        type: 'concept',
        label: ancestorConcept.label,
        properties: { conceptId: ancestorId, domain: ancestorConcept.domain },
      });
    } else {
      // Root anchors like 'dataset', 'systems' aren't full concepts — add minimal node
      graph.addNode({
        id: nodeId('concept', ancestorId),
        type: 'concept',
        label: ancestorId,
        properties: { conceptId: ancestorId },
      });
    }

    // Add is_a edge between consecutive ancestors
    // ['ai', 'ml', 'deep_learning', 'cnn'] → ai→ml, ml→dl, dl→cnn
    if (i < ancestors.length - 1) {
      const childId = ancestors[i + 1]!;
      graph.addEdge({
        from: nodeId('concept', childId),
        to: nodeId('concept', ancestorId),
        type: 'is_a',
        weight: 0.7,
      });
    }
  }
}

// ─── Ontology relations helper ─────────────────────────────────────────────────
// For each relation declared in the ontology (e.g. cnn -[solves]-> image_classification),
// add the target as a concept node and the relation as an inferred edge (weight 0.7).
// This is what makes the graph richer than just raw KnowledgeCore fields.

function addOntologyRelations(
  graph: KnowledgeGraphImpl,
  conceptId: string,
  cache: OntologyCache,
): void {
  const relations = cache.getRelations(conceptId);
  const fromId = nodeId('concept', conceptId);

  for (const relation of relations) {
    const targetConcept = cache.getById(relation.target);
    if (!targetConcept) continue; // skip if target isn't in the ontology

    const toId = nodeId('concept', relation.target);

    graph.addNode({
      id: toId,
      type: 'concept',
      label: targetConcept.label,
      properties: {
        conceptId: relation.target,
        domain: targetConcept.domain,
      },
    });

    graph.addEdge({
      from: fromId,
      to: toId,
      type: relation.type,
      weight: 0.7, // inferred from ontology — not extracted directly from the note
    });
  }
}
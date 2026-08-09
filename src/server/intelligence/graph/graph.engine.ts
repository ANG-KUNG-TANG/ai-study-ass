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
      properties: {
        ...(existing.properties ?? {}),
        ...(node.properties ?? {}),
      },
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
      (edge) =>
        (edge.from === nodeId || edge.to === nodeId) &&
        (!type || edge.type === type),
    );
  }

  getNeighbors(nodeId: string, type?: RelationType): GraphNode[] {
    const ids = new Set<string>();

    for (const edge of this.getEdges(nodeId, type)) {
      ids.add(edge.from === nodeId ? edge.to : edge.from);
    }

    return [...ids]
      .map((id) => this.nodes.get(id))
      .filter((node): node is GraphNode => Boolean(node));
  }

  bfs(startId: string, maxDepth = Number.POSITIVE_INFINITY): BFSResult {
    const distances = new Map<string, number>();
    const order: Array<{ id: string; depth: number }> = [];

    if (!this.nodes.has(startId)) {
      return { startId, distances, order };
    }

    const queue: Array<{ id: string; depth: number }> = [
      { id: startId, depth: 0 },
    ];

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
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }

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

    return new Map(
      [...degrees.entries()].map(([id, degree]) => [
        id,
        max === 0 ? 0 : degree / max,
      ]),
    );
  }
}

interface SectionInfo {
  id: string;
  title: string;
  pageNumber?: number;
  order: number;
  evidenceIds: Set<string>;
}

interface ConceptRef {
  nodeId: string;
  label: string;
  normalized: string;
  aliases: string[];
  evidenceIds: string[];
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
      provenance: "document",
      learningRole: "root",
      description:
        "The uploaded document. Open a section or concept to follow the learning structure.",
    },
  });

  const validConcepts = core.concepts
    .filter((item) => item.valid && item.evidence.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  const validClaims = core.claims.filter(
    (item) =>
      item.validationStatus === "valid" &&
      item.evidence.length > 0,
  );

  const sections = collectSections(validConcepts, validClaims);

  for (const section of sections) {
    const sectionNodeId = sectionNodeIdFor(section.id);

    graph.addNode({
      id: sectionNodeId,
      type: "section",
      label: section.title,
      properties: {
        pageNumber: section.pageNumber,
        learningOrder: section.order,
        evidenceIds: [...section.evidenceIds],
        provenance: "document",
        learningRole: "section",
        description: `Part ${section.order + 1} of the document learning path.`,
      },
    });

    graph.addEdge({
      from: paperId,
      to: sectionNodeId,
      type: "contains",
      weight: 1,
      evidenceIds: [...section.evidenceIds],
    });
  }

  const conceptRefs: ConceptRef[] = [];

  for (const concept of validConcepts) {
    const resolution = ontology.resolve(concept.term);

    // Fuzzy/generated ontology matches can introduce unrelated external
    // concepts. Use ontology canonicalisation only for exact/alias matches.
    const useCanonical =
      resolution.matchType === "exact" ||
      resolution.matchType === "alias";

    const label = useCanonical
      ? resolution.concept.label
      : concept.term;

    const normalized = normalizeTerm(label || concept.normalizedTerm);
    const conceptId = `concept:local-${slugify(concept.normalizedTerm)}`;
    const evidenceIds = concept.evidence.map((evidence) => evidence.id);

    graph.addNode({
      id: conceptId,
      type: "concept",
      label,
      properties: {
        status: "document_grounded",
        provenance: "document",
        learningRole:
          concept.score >= 0.8 || concept.occurrences >= 3
            ? "key_concept"
            : "supporting_concept",
        occurrences: concept.occurrences,
        score: concept.score,
        rawInput: concept.term,
        definition:
          concept.definition ??
          inferDefinitionFromEvidence(label, concept.evidence.map((item) => item.text)),
        evidence: concept.evidence,
        sectionIds: concept.sectionIds,
        ontologyMatchType: useCanonical ? resolution.matchType : "not_used",
      },
    });

    const attachedSections = new Set(
      concept.evidence
        .map((evidence) => evidence.sectionId)
        .filter(Boolean),
    );

    if (attachedSections.size > 0) {
      for (const sectionId of attachedSections) {
        graph.addEdge({
          from: sectionNodeIdFor(sectionId),
          to: conceptId,
          type: "contains",
          weight: concept.score,
          evidenceIds,
        });
      }
    } else {
      graph.addEdge({
        from: paperId,
        to: conceptId,
        type: "mentions",
        weight: concept.score,
        evidenceIds,
      });
    }

    conceptRefs.push({
      nodeId: conceptId,
      label,
      normalized,
      aliases: [
        normalizeTerm(concept.term),
        normalizeTerm(concept.normalizedTerm),
        useCanonical ? normalizeTerm(resolution.concept.label) : "",
      ].filter(Boolean),
      evidenceIds,
    });
  }

  for (const claim of validClaims) {
    const claimId = `claim:${claim.id}`;
    const nodeType = claim.type === "result" ? "result" : "claim";
    const evidenceIds = claim.evidence.map((evidence) => evidence.id);

    graph.addNode({
      id: claimId,
      type: nodeType,
      label:
        claim.type === "definition" && claim.subject
          ? claim.subject
          : claim.object,
      properties: {
        claimType: claim.type,
        subject: claim.subject,
        predicate: claim.predicate,
        metric: claim.metric,
        numericValue: claim.numericValue,
        unit: claim.unit,
        confidence: claim.confidence,
        evidence: claim.evidence,
        description: claimSentence(claim.subject, claim.predicate, claim.object),
        provenance:
          claim.extractionSource === "ai"
            ? "ai_grounded"
            : "document",
        learningRole: "grounded_claim",
      },
    });

    const sectionId = claim.evidence[0]?.sectionId;

    graph.addEdge({
      from: sectionId ? sectionNodeIdFor(sectionId) : paperId,
      to: claimId,
      type: relationForClaim(claim.type),
      weight: claim.confidence,
      evidenceIds,
    });

    const subjectConcept = findConceptRef(claim.subject, conceptRefs);
    const objectConcept = findConceptRef(claim.object, conceptRefs);

    if (
      subjectConcept &&
      objectConcept &&
      subjectConcept.nodeId !== objectConcept.nodeId
    ) {
      graph.addEdge({
        from: subjectConcept.nodeId,
        to: objectConcept.nodeId,
        type: relationFromPredicate(claim.predicate, claim.type),
        weight: claim.confidence,
        evidenceIds,
      });
    }

    if (["method", "tool", "data_source", "sample", "metric"].includes(claim.type)) {
      const typedNode = makeTypedNode(
        claim.type,
        claim.object,
        claim.numericValue,
        claim.metric,
      );

      graph.addNode({
        ...typedNode,
        properties: {
          ...(typedNode.properties ?? {}),
          provenance: "document",
          evidence: claim.evidence,
          description: claim.object,
        },
      });

      graph.addEdge({
        from: claimId,
        to: typedNode.id,
        type: "supports",
        weight: claim.confidence,
        evidenceIds,
      });
    }
  }

  addGroundedConceptRelations(graph, validConcepts, conceptRefs);

  return graph;
}

function collectSections(
  concepts: KnowledgeCore["concepts"],
  claims: KnowledgeCore["claims"],
): SectionInfo[] {
  const sections = new Map<string, SectionInfo>();
  let order = 0;

  const register = (
    sectionId: string,
    sectionTitle: string,
    pageNumber: number | undefined,
    evidenceId: string,
  ) => {
    const id = sectionId || `section-${slugify(sectionTitle || "Document")}`;
    const title = sectionTitle?.trim() || "Document";

    const existing = sections.get(id);

    if (existing) {
      existing.evidenceIds.add(evidenceId);
      if (!existing.pageNumber && pageNumber) {
        existing.pageNumber = pageNumber;
      }
      return;
    }

    sections.set(id, {
      id,
      title,
      pageNumber,
      order,
      evidenceIds: new Set([evidenceId]),
    });

    order += 1;
  };

  for (const concept of concepts) {
    for (const evidence of concept.evidence) {
      register(
        evidence.sectionId,
        evidence.sectionTitle,
        evidence.pageNumber,
        evidence.id,
      );
    }
  }

  for (const claim of claims) {
    for (const evidence of claim.evidence) {
      register(
        evidence.sectionId,
        evidence.sectionTitle,
        evidence.pageNumber,
        evidence.id,
      );
    }
  }

  return [...sections.values()];
}

function addGroundedConceptRelations(
  graph: InMemoryKnowledgeGraph,
  concepts: KnowledgeCore["concepts"],
  refs: ConceptRef[],
): void {
  const evidenceToRefs = new Map<
    string,
    { text: string; refs: ConceptRef[] }
  >();

  for (const concept of concepts) {
    const ref = refs.find(
      (candidate) =>
        candidate.aliases.includes(normalizeTerm(concept.term)) ||
        candidate.aliases.includes(normalizeTerm(concept.normalizedTerm)),
    );

    if (!ref) continue;

    for (const evidence of concept.evidence) {
      const current = evidenceToRefs.get(evidence.id) ?? {
        text: evidence.text,
        refs: [],
      };

      if (!current.refs.some((item) => item.nodeId === ref.nodeId)) {
        current.refs.push(ref);
      }

      evidenceToRefs.set(evidence.id, current);
    }
  }

  for (const [evidenceId, group] of evidenceToRefs) {
    // Prevent dense "everything relates to everything" clusters.
    if (group.refs.length < 2 || group.refs.length > 6) continue;

    for (let left = 0; left < group.refs.length; left += 1) {
      for (let right = left + 1; right < group.refs.length; right += 1) {
        const a = group.refs[left];
        const b = group.refs[right];
        const inferred = inferGroundedRelation(group.text, a, b);

        if (!inferred) continue;

        graph.addEdge({
          from: inferred.from,
          to: inferred.to,
          type: inferred.type,
          weight: 0.72,
          evidenceIds: [evidenceId],
        });
      }
    }
  }
}

function inferGroundedRelation(
  text: string,
  a: ConceptRef,
  b: ConceptRef,
): { from: string; to: string; type: RelationType } | null {
  const sentence = normalizeTerm(text);
  const aLabel = chooseMention(sentence, a);
  const bLabel = chooseMention(sentence, b);

  if (!aLabel || !bLabel) return null;

  const aIndex = sentence.indexOf(aLabel);
  const bIndex = sentence.indexOf(bLabel);

  if (aIndex < 0 || bIndex < 0) return null;

  const [first, second, firstIndex, secondIndex] =
    aIndex <= bIndex
      ? [a, b, aIndex, bIndex]
      : [b, a, bIndex, aIndex];

  const between = sentence
    .slice(firstIndex, secondIndex + 1)
    .replace(/\s+/g, " ");

  if (/\b(is|are|was|were)\s+(an?|the)?\s*$/.test(between)) {
    return { from: first.nodeId, to: second.nodeId, type: "is_a" };
  }

  if (/\b(part of|component of|belongs to)\b/.test(between)) {
    return { from: first.nodeId, to: second.nodeId, type: "part_of" };
  }

  if (/\b(uses?|using|utilizes?|employs?)\b/.test(between)) {
    return { from: first.nodeId, to: second.nodeId, type: "uses" };
  }

  if (/\b(defines?|describes?|means?|refers to)\b/.test(between)) {
    return { from: first.nodeId, to: second.nodeId, type: "defines" };
  }

  if (
    /\b(leads? to|flows? into|transforms? into|next step|becomes?|guides?|results? in)\b/.test(
      between,
    )
  ) {
    return { from: first.nodeId, to: second.nodeId, type: "influences" };
  }

  if (/\b(includes?|contains?|consists? of|comprises?)\b/.test(between)) {
    return { from: first.nodeId, to: second.nodeId, type: "contains" };
  }

  if (/\b(supports?|validates?)\b/.test(between)) {
    return { from: first.nodeId, to: second.nodeId, type: "supports" };
  }

  if (text.includes("→") || text.includes("->")) {
    return { from: first.nodeId, to: second.nodeId, type: "influences" };
  }

  return null;
}

function chooseMention(sentence: string, ref: ConceptRef): string | null {
  const candidates = [ref.normalized, ...ref.aliases]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  return candidates.find((candidate) => sentence.includes(candidate)) ?? null;
}

function findConceptRef(
  value: string,
  refs: ConceptRef[],
): ConceptRef | null {
  const normalized = normalizeTerm(value);
  if (!normalized) return null;

  return (
    refs.find(
      (ref) =>
        ref.normalized === normalized ||
        ref.aliases.includes(normalized),
    ) ??
    refs.find(
      (ref) =>
        normalized.includes(ref.normalized) ||
        ref.normalized.includes(normalized),
    ) ??
    null
  );
}

function inferDefinitionFromEvidence(
  label: string,
  evidenceTexts: string[],
): string | undefined {
  const normalizedLabel = normalizeTerm(label);

  const explicit = evidenceTexts.find((text) => {
    const normalized = normalizeTerm(text);
    return (
      normalized.includes(normalizedLabel) &&
      /\b(is|are|means|refers to|defined as|process of)\b/i.test(text)
    );
  });

  if (explicit) {
    return truncateSentence(explicit, 260);
  }

  const first = evidenceTexts.find((text) =>
    normalizeTerm(text).includes(normalizedLabel),
  );

  return first ? truncateSentence(first, 220) : undefined;
}

function truncateSentence(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= maxLength
    ? clean
    : `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function claimSentence(
  subject: string,
  predicate: string,
  object: string,
): string {
  return [subject, predicate, object]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function relationFromPredicate(
  predicate: string,
  claimType: KnowledgeCore["claims"][number]["type"],
): RelationType {
  const value = normalizeTerm(predicate);

  if (/\buse|using|utilize|employ\b/.test(value)) return "uses";
  if (/\bpart|component|belongs\b/.test(value)) return "part_of";
  if (/\bdefine|mean|refer\b/.test(value)) return "defines";
  if (/\bsupport|validate\b/.test(value)) return "supports";
  if (/\blead|flow|transform|guide|result|become\b/.test(value)) {
    return "influences";
  }

  return relationForClaim(claimType);
}

function sectionNodeIdFor(sectionId: string): string {
  return `section:${slugify(sectionId || "document")}`;
}

function relationForClaim(
  type: KnowledgeCore["claims"][number]["type"],
): RelationType {
  switch (type) {
    case "method":
      return "uses";
    case "tool":
      return "uses_tool";
    case "sample":
    case "data_source":
      return "evaluated_on";
    case "problem":
      return "has_problem";
    case "definition":
      return "defines";
    case "result":
    case "metric":
      return "reports";
    default:
      return "contains";
  }
}

function makeTypedNode(
  type: string,
  value: string,
  numericValue?: number,
  metric?: string,
): GraphNode {
  const slug = slugify(value);

  if (type === "method") {
    return {
      id: `method:${slug}`,
      type: "method",
      label: value,
    };
  }

  if (type === "tool") {
    return {
      id: `tool:${slug}`,
      type: "tool",
      label: value,
    };
  }

  if (type === "data_source") {
    return {
      id: `dataset:${slug}`,
      type: "dataset",
      label: value,
    };
  }

  if (type === "sample") {
    return {
      id: `sample:${slug}`,
      type: "sample",
      label: value,
      properties: { value: numericValue },
    };
  }

  return {
    id: `metric:${slug}`,
    type: "metric",
    label: value,
    properties: {
      value: numericValue,
      metric,
    },
  };
}

function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_–—-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

export { InMemoryKnowledgeGraph };

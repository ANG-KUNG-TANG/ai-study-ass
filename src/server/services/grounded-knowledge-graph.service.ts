import type {
  AtomicFact,
  GroundedKnowledge,
  ImportantConcept,
  QualifiedTerm,
} from "@/server/intelligence/grounding";
import type {
  GraphData,
  GraphEdgeData,
  GraphNodeData,
  KnowledgeGraphQuality,
} from "@/server/types/Knowledge";

const VISIBLE_SECTION_STATUSES = new Set([
  "covered",
  "no_extractable_knowledge",
]);

const POSITIVE_CAUSAL_RELATIONS = new Set([
  "causes",
  "leads_to",
  "enables",
]);

const NEGATIVE_CAUSAL_RELATIONS = new Set([
  "prevents",
]);

interface SemanticRegistryEntry {
  nodeId: string;
  label: string;
  aliases: Set<string>;
}

interface Mention {
  nodeId: string;
  start: number;
  end: number;
  alias: string;
}

interface SemanticGraphState {
  nodes: GraphNodeData[];
  nodesById: Map<string, GraphNodeData>;
  structuralEdges: GraphEdgeData[];
  semanticEdges: Map<string, GraphEdgeData>;
  registry: Map<string, SemanticRegistryEntry>;
  aliasToNodeId: Map<string, string>;
  visibleSectionIds: Set<string>;
  duplicateEdgeCount: number;
  conflictingEdgeCount: number;
  skippedUnsafeRelationshipCount: number;
  omittedUngroundedNodeCount: number;
  relationshipCandidateCount: number;
  parsedRelationshipCandidateCount: number;
}

export interface GroundedKnowledgeGraphResult {
  graph: GraphData;
  quality: KnowledgeGraphQuality;
}

export function buildGroundedKnowledgeGraph(
  grounding: GroundedKnowledge,
): GraphData {
  return buildGroundedKnowledgeGraphResult(grounding).graph;
}

export function buildGroundedKnowledgeGraphResult(
  grounding: GroundedKnowledge,
): GroundedKnowledgeGraphResult {
  const documentNode: GraphNodeData = {
    id: "grounded-document",
    type: "paper",
    label: "Document",
    properties: {
      description:
        "The uploaded document and root of this evidence-grounded knowledge map.",
      confidence: grounding.quality.score,
      provenance: "document",
    },
  };

  const state: SemanticGraphState = {
    nodes: [documentNode],
    nodesById: new Map([
      [documentNode.id, documentNode],
    ]),
    structuralEdges: [],
    semanticEdges: new Map(),
    registry: new Map(),
    aliasToNodeId: new Map(),
    visibleSectionIds: new Set(),
    duplicateEdgeCount: 0,
    conflictingEdgeCount: 0,
    skippedUnsafeRelationshipCount: 0,
    omittedUngroundedNodeCount: 0,
    relationshipCandidateCount: 0,
    parsedRelationshipCandidateCount: 0,
  };

  addSections(state, grounding);
  addSupportedFacts(state, grounding);
  addConceptNodes(state, grounding.concepts);
  addTermNodes(state, grounding.keyTerms);
  addSemanticRelationships(state, grounding.facts);
  resolveSemanticConflicts(state);

  const semanticEdges = [
    ...state.semanticEdges.values(),
  ];
  const graph: GraphData = {
    nodes: uniqueNodes(state.nodes),
    edges: uniqueEdges([
      ...state.structuralEdges,
      ...semanticEdges,
    ]),
  };

  return {
    graph,
    quality: buildQuality(
      state,
      graph,
      semanticEdges,
    ),
  };
}

function addSections(
  state: SemanticGraphState,
  grounding: GroundedKnowledge,
): void {
  grounding.sections.forEach(
    (section, learningOrder) => {
      if (
        !VISIBLE_SECTION_STATUSES.has(
          section.status,
        )
      ) {
        return;
      }

      state.visibleSectionIds.add(
        section.sectionId,
      );

      const sectionNode: GraphNodeData = {
        id: section.sectionId,
        type: "section",
        label: cleanHeading(section.heading),
        properties: {
          description:
            section.status ===
            "no_extractable_knowledge"
              ? "This source section contains no extractable study facts."
              : "A source-grounded section in the document learning path.",
          learningOrder: learningOrder + 1,
          pageNumber: section.pageStart,
          pageEnd: section.pageEnd,
          factCount: section.factIds.length,
          provenance: "document",
        },
      };

      pushNode(state, sectionNode);
      state.structuralEdges.push({
        from: "grounded-document",
        to: section.sectionId,
        type: "contains",
        weight: 1,
      });
    },
  );
}

function addSupportedFacts(
  state: SemanticGraphState,
  grounding: GroundedKnowledge,
): void {
  const visibleFacts = grounding.facts.filter(
    (fact) =>
      fact.verificationStatus === "supported" &&
      fact.evidence.length > 0 &&
      state.visibleSectionIds.has(
        fact.sourceSectionId,
      ),
  );

  const orderBySection = new Map<string, number>();

  for (const fact of visibleFacts) {
    const currentOrder =
      (orderBySection.get(
        fact.sourceSectionId,
      ) ?? 0) + 1;
    orderBySection.set(
      fact.sourceSectionId,
      currentOrder,
    );

    pushNode(
      state,
      factNode(
        fact,
        currentOrder,
      ),
    );

    state.structuralEdges.push({
      from: fact.sourceSectionId,
      to: fact.id,
      type: "contains",
      weight: fact.importanceScore,
      evidenceIds: uniqueStrings(
        fact.evidence.map(
          (evidence) => evidence.id,
        ),
      ),
    });
  }
}

function addConceptNodes(
  state: SemanticGraphState,
  concepts: ImportantConcept[],
): void {
  concepts.forEach((concept, index) => {
    if (concept.evidence.length === 0) {
      state.omittedUngroundedNodeCount += 1;
      return;
    }

    const conceptId =
      `grounded-concept-${safeId(
        concept.normalizedName,
      )}-${index + 1}`;

    const node: GraphNodeData = {
      id: conceptId,
      type: "concept",
      label: concept.name,
      properties: {
        explanation: concept.explanation,
        confidence: concept.importanceScore,
        score: concept.importanceScore,
        evidence: concept.evidence,
        aliases: [concept.name],
        provenance: "document",
      },
    };

    pushNode(state, node);
    registerSemanticNode(
      state,
      node.id,
      concept.name,
    );
    connectEvidenceToSource(
      state,
      node.id,
      concept.evidence,
      concept.importanceScore,
    );
  });
}

function addTermNodes(
  state: SemanticGraphState,
  terms: QualifiedTerm[],
): void {
  terms.forEach((term, index) => {
    if (term.evidence.length === 0) {
      state.omittedUngroundedNodeCount += 1;
      return;
    }

    const aliasNodeId =
      findAliasNodeId(
        state,
        term.term,
      );

    if (aliasNodeId) {
      mergeTermIntoNode(
        state,
        aliasNodeId,
        term,
      );
      connectEvidenceToSource(
        state,
        aliasNodeId,
        term.evidence,
        term.confidence,
      );
      return;
    }

    const nodeId =
      `grounded-term-${safeId(
        term.term,
      )}-${index + 1}`;

    const node: GraphNodeData = {
      id: nodeId,
      type: "term",
      label: term.term,
      properties: {
        definition: term.definition,
        confidence: term.confidence,
        score: term.confidence,
        evidence: term.evidence,
        aliases: [term.term],
        qualification: term.qualification,
        provenance: "document",
      },
    };

    pushNode(state, node);
    registerSemanticNode(
      state,
      node.id,
      term.term,
    );
    connectEvidenceToSource(
      state,
      node.id,
      term.evidence,
      term.confidence,
    );
  });
}

function connectEvidenceToSource(
  state: SemanticGraphState,
  nodeId: string,
  evidence: Array<{
    id: string;
    sectionId: string;
  }>,
  weight: number,
): void {
  const bySection = new Map<
    string,
    string[]
  >();

  for (const item of evidence) {
    if (
      !state.visibleSectionIds.has(
        item.sectionId,
      )
    ) {
      continue;
    }

    const ids =
      bySection.get(item.sectionId) ?? [];
    ids.push(item.id);
    bySection.set(item.sectionId, ids);
  }

  if (bySection.size === 0) {
    state.structuralEdges.push({
      from: "grounded-document",
      to: nodeId,
      type: "mentions",
      weight,
      evidenceIds: uniqueStrings(
        evidence.map((item) => item.id),
      ),
    });
    return;
  }

  for (const [sectionId, evidenceIds]
    of bySection) {
    state.structuralEdges.push({
      from: sectionId,
      to: nodeId,
      type: "mentions",
      weight,
      evidenceIds:
        uniqueStrings(evidenceIds),
    });
  }
}

function mergeTermIntoNode(
  state: SemanticGraphState,
  nodeId: string,
  term: QualifiedTerm,
): void {
  const node =
    state.nodesById.get(nodeId);
  if (!node) return;

  const properties =
    node.properties ?? {};
  const existingEvidence =
    Array.isArray(properties.evidence)
      ? properties.evidence
      : [];
  const existingAliases =
    Array.isArray(properties.aliases)
      ? properties.aliases.filter(
          (value): value is string =>
            typeof value === "string",
        )
      : [];

  node.properties = {
    ...properties,
    definition:
      typeof properties.definition ===
        "string"
        ? properties.definition
        : term.definition,
    confidence: Math.max(
      asFiniteNumber(
        properties.confidence,
      ) ?? 0,
      term.confidence,
    ),
    evidence: uniqueEvidence([
      ...existingEvidence,
      ...term.evidence,
    ]),
    aliases: uniqueStrings([
      ...existingAliases,
      term.term,
    ]),
    qualification: term.qualification,
  };

  addAlias(
    state,
    nodeId,
    term.term,
  );
}

function addSemanticRelationships(
  state: SemanticGraphState,
  facts: AtomicFact[],
): void {
  for (const fact of facts) {
    if (
      fact.verificationStatus !==
        "supported" ||
      fact.evidence.length === 0
    ) {
      continue;
    }

    const text = normalise(
      fact.content,
    );
    const mentions = findMentions(
      state,
      text,
    );

    if (mentions.length < 2) {
      continue;
    }

    const relationshipCandidate =
      fact.type === "relationship" ||
      hasExplicitRelationCue(text);

    if (relationshipCandidate) {
      state.relationshipCandidateCount += 1;
    }

    let parsedAny = false;

    for (
      let index = 0;
      index < mentions.length - 1;
      index += 1
    ) {
      const left = mentions[index]!;
      const right =
        mentions[index + 1]!;

      if (left.nodeId === right.nodeId) {
        continue;
      }

      const between = text
        .slice(
          left.end,
          right.start,
        )
        .trim();

      const relation =
        inferRelation(between);

      if (!relation) continue;

      const from = relation.reverse
        ? right.nodeId
        : left.nodeId;
      const to = relation.reverse
        ? left.nodeId
        : right.nodeId;

      addSemanticEdge(
        state,
        {
          from,
          to,
          type: relation.type,
          weight:
            relationshipWeight(fact),
          evidenceIds:
            uniqueStrings(
              fact.evidence.map(
                (evidence) =>
                  evidence.id,
              ),
            ),
        },
      );

      parsedAny = true;
    }

    if (
      relationshipCandidate &&
      parsedAny
    ) {
      state.parsedRelationshipCandidateCount +=
        1;
    } else if (
      relationshipCandidate
    ) {
      state.skippedUnsafeRelationshipCount +=
        1;
    }
  }
}

function inferRelation(
  between: string,
): {
  type: string;
  reverse: boolean;
} | null {
  const value = between
    .replace(/\s+/g, " ")
    .trim();

  const forward: Array<{
    pattern: RegExp;
    type: string;
  }> = [
    {
      pattern:
        /^(?:is|are)\s+(?:a|an|the)?\s*(?:type|kind|form|subtype|category)\s+of$/u,
      type: "is_a",
    },
    {
      pattern:
        /^(?:is|are)\s+(?:a|an|the)?\s*(?:part|component|member)\s+of$/u,
      type: "part_of",
    },
    {
      pattern:
        /^(?:contains?|includes?|comprises?|consists?\s+of)(?:\s+(?:the|a|an))?$/u,
      type: "contains",
    },
    {
      pattern:
        /^(?:depends?\s+on|relies?\s+on)(?:\s+(?:the|a|an))?$/u,
      type: "depends_on",
    },
    {
      pattern:
        /^(?:uses?|utilizes?|employs?)(?:\s+(?:the|a|an))?$/u,
      type: "uses",
    },
    {
      pattern:
        /^(?:requires?|needs?)(?:\s+(?:the|a|an))?$/u,
      type: "requires",
    },
    {
      pattern:
        /^(?:prevents?|avoids?|blocks?|inhibits?)(?:\s+(?:the|a|an))?$/u,
      type: "prevents",
    },
    {
      pattern:
        /^(?:causes?|produces?|results?\s+in)(?:\s+(?:the|a|an))?$/u,
      type: "causes",
    },
    {
      pattern:
        /^(?:leads?\s+to)(?:\s+(?:the|a|an))?$/u,
      type: "leads_to",
    },
    {
      pattern:
        /^(?:supports?)(?:\s+(?:the|a|an))?$/u,
      type: "supports",
    },
    {
      pattern:
        /^(?:protects?)(?:\s+(?:the|a|an))?$/u,
      type: "protects",
    },
    {
      pattern:
        /^(?:controls?|governs?)(?:\s+(?:the|a|an))?$/u,
      type: "controls",
    },
    {
      pattern:
        /^(?:enables?|allows?)(?:\s+(?:the|a|an))?$/u,
      type: "enables",
    },
    {
      pattern:
        /^(?:defines?|describes?)(?:\s+(?:the|a|an))?$/u,
      type: "defines",
    },
    {
      pattern:
        /^(?:connects?\s+to|maps?\s+to|is\s+related\s+to|are\s+related\s+to|is\s+associated\s+with|are\s+associated\s+with)$/u,
      type: "related_to",
    },
  ];

  for (const candidate of forward) {
    if (
      candidate.pattern.test(value)
    ) {
      return {
        type: candidate.type,
        reverse: false,
      };
    }
  }

  const passive: Array<{
    pattern: RegExp;
    type: string;
  }> = [
    {
      pattern:
        /^(?:is|are)\s+(?:prevented|blocked|inhibited)\s+by$/u,
      type: "prevents",
    },
    {
      pattern:
        /^(?:is|are)\s+(?:caused|produced)\s+by$/u,
      type: "causes",
    },
    {
      pattern:
        /^(?:is|are)\s+supported\s+by$/u,
      type: "supports",
    },
    {
      pattern:
        /^(?:is|are)\s+protected\s+by$/u,
      type: "protects",
    },
    {
      pattern:
        /^(?:is|are)\s+controlled\s+by$/u,
      type: "controls",
    },
    {
      pattern:
        /^(?:is|are)\s+defined\s+by$/u,
      type: "defines",
    },
  ];

  for (const candidate of passive) {
    if (
      candidate.pattern.test(value)
    ) {
      return {
        type: candidate.type,
        reverse: true,
      };
    }
  }

  return null;
}

function hasExplicitRelationCue(
  text: string,
): boolean {
  return /\b(?:type|kind|form|subtype|category|part|component|member|contains?|includes?|comprises?|consists?|depends?|relies?|uses?|utilizes?|employs?|requires?|needs?|prevents?|avoids?|blocks?|inhibits?|causes?|produces?|results?|leads?|supports?|protects?|controls?|governs?|enables?|allows?|defines?|describes?|connects?|maps?|related|associated)\b/u.test(
    text,
  );
}

function addSemanticEdge(
  state: SemanticGraphState,
  edge: GraphEdgeData,
): void {
  let from = edge.from;
  let to = edge.to;

  if (
    edge.type === "related_to" &&
    from.localeCompare(to) > 0
  ) {
    [from, to] = [to, from];
  }

  const key =
    `${from}:${edge.type}:${to}`;
  const existing =
    state.semanticEdges.get(key);

  if (existing) {
    state.duplicateEdgeCount += 1;
    existing.weight = Math.max(
      existing.weight,
      edge.weight,
    );
    existing.evidenceIds =
      uniqueStrings([
        ...(existing.evidenceIds ?? []),
        ...(edge.evidenceIds ?? []),
      ]);
    return;
  }

  state.semanticEdges.set(key, {
    ...edge,
    from,
    to,
    evidenceIds:
      uniqueStrings(
        edge.evidenceIds ?? [],
      ),
  });
}

function resolveSemanticConflicts(
  state: SemanticGraphState,
): void {
  resolveCausalConflicts(state);
  resolveReverseHierarchyConflicts(
    state,
    "is_a",
  );
  resolveReverseHierarchyConflicts(
    state,
    "part_of",
  );
}

function resolveCausalConflicts(
  state: SemanticGraphState,
): void {
  const byPair = new Map<
    string,
    GraphEdgeData[]
  >();

  for (
    const edge of
    state.semanticEdges.values()
  ) {
    const key = `${edge.from}:${edge.to}`;
    const edges = byPair.get(key) ?? [];
    edges.push(edge);
    byPair.set(key, edges);
  }

  for (const edges of byPair.values()) {
    const hasPositive = edges.some(
      (edge) =>
        POSITIVE_CAUSAL_RELATIONS.has(
          edge.type,
        ),
    );
    const hasNegative = edges.some(
      (edge) =>
        NEGATIVE_CAUSAL_RELATIONS.has(
          edge.type,
        ),
    );

    if (!hasPositive || !hasNegative) {
      continue;
    }

    state.conflictingEdgeCount += 1;

    for (const edge of edges) {
      if (
        POSITIVE_CAUSAL_RELATIONS.has(
          edge.type,
        ) ||
        NEGATIVE_CAUSAL_RELATIONS.has(
          edge.type,
        )
      ) {
        state.semanticEdges.delete(
          `${edge.from}:${edge.type}:${edge.to}`,
        );
      }
    }
  }
}

function resolveReverseHierarchyConflicts(
  state: SemanticGraphState,
  relationType: string,
): void {
  const visited =
    new Set<string>();

  for (
    const edge of
    [...state.semanticEdges.values()]
  ) {
    if (edge.type !== relationType) {
      continue;
    }

    const unordered =
      [edge.from, edge.to]
        .sort()
        .join(":");

    if (visited.has(unordered)) {
      continue;
    }
    visited.add(unordered);

    const reverseKey =
      `${edge.to}:${relationType}:${edge.from}`;

    if (
      state.semanticEdges.has(
        reverseKey,
      )
    ) {
      state.conflictingEdgeCount += 1;
      state.semanticEdges.delete(
        `${edge.from}:${relationType}:${edge.to}`,
      );
      state.semanticEdges.delete(
        reverseKey,
      );
    }
  }
}

function registerSemanticNode(
  state: SemanticGraphState,
  nodeId: string,
  label: string,
): void {
  const aliases = new Set<string>();
  const normalisedLabel =
    normalise(label);
  if (normalisedLabel) {
    aliases.add(normalisedLabel);
  }

  const acronym = initialism(label);
  if (acronym.length >= 2) {
    aliases.add(acronym);
  }

  const entry: SemanticRegistryEntry = {
    nodeId,
    label,
    aliases,
  };

  state.registry.set(
    nodeId,
    entry,
  );

  for (const alias of aliases) {
    if (
      !state.aliasToNodeId.has(alias)
    ) {
      state.aliasToNodeId.set(
        alias,
        nodeId,
      );
    }
  }
}

function addAlias(
  state: SemanticGraphState,
  nodeId: string,
  alias: string,
): void {
  const entry =
    state.registry.get(nodeId);
  if (!entry) return;

  const values = [
    normalise(alias),
    initialism(alias),
  ].filter(
    (value) => value.length >= 2,
  );

  for (const value of values) {
    entry.aliases.add(value);

    if (
      !state.aliasToNodeId.has(value)
    ) {
      state.aliasToNodeId.set(
        value,
        nodeId,
      );
    }
  }
}

function findAliasNodeId(
  state: SemanticGraphState,
  label: string,
): string | null {
  const direct =
    state.aliasToNodeId.get(
      normalise(label),
    );

  if (direct) return direct;

  const acronym = initialism(label);
  if (acronym.length >= 2) {
    const acronymMatch =
      state.aliasToNodeId.get(acronym);
    if (acronymMatch) {
      return acronymMatch;
    }
  }

  for (
    const entry of
    state.registry.values()
  ) {
    if (
      isAcronymAlias(
        label,
        entry.label,
      )
    ) {
      return entry.nodeId;
    }
  }

  return null;
}

function findMentions(
  state: SemanticGraphState,
  text: string,
): Mention[] {
  const candidates: Mention[] = [];

  for (
    const entry of
    state.registry.values()
  ) {
    for (const alias of entry.aliases) {
      if (alias.length < 2) continue;

      let searchFrom = 0;

      while (searchFrom < text.length) {
        const start =
          text.indexOf(
            alias,
            searchFrom,
          );

        if (start < 0) break;

        const end =
          start + alias.length;

        if (
          hasBoundary(
            text,
            start,
            end,
          )
        ) {
          candidates.push({
            nodeId: entry.nodeId,
            start,
            end,
            alias,
          });
        }

        searchFrom =
          Math.max(end, start + 1);
      }
    }
  }

  candidates.sort(
    (left, right) =>
      left.start - right.start ||
      (right.end - right.start) -
        (left.end - left.start),
  );

  const selected: Mention[] = [];

  for (const candidate of candidates) {
    const overlaps = selected.some(
      (current) =>
        candidate.start <
          current.end &&
        current.start <
          candidate.end,
    );

    if (!overlaps) {
      selected.push(candidate);
    }
  }

  return selected.sort(
    (left, right) =>
      left.start - right.start,
  );
}

function hasBoundary(
  text: string,
  start: number,
  end: number,
): boolean {
  const before =
    start === 0
      ? ""
      : text[start - 1] ?? "";
  const after =
    end >= text.length
      ? ""
      : text[end] ?? "";

  return (
    !isAlphaNumeric(before) &&
    !isAlphaNumeric(after)
  );
}

function isAlphaNumeric(
  value: string,
): boolean {
  return /[\p{L}\p{N}\p{M}]/u.test(
    value,
  );
}

function buildQuality(
  state: SemanticGraphState,
  graph: GraphData,
  semanticEdges: GraphEdgeData[],
): KnowledgeGraphQuality {
  const semanticNodeIds =
    new Set(
      graph.nodes
        .filter((node) =>
          node.type === "concept" ||
          node.type === "term",
        )
        .map((node) => node.id),
    );

  const connectedSemanticNodeIds =
    new Set<string>();

  for (const edge of semanticEdges) {
    if (
      semanticNodeIds.has(edge.from)
    ) {
      connectedSemanticNodeIds.add(
        edge.from,
      );
    }
    if (
      semanticNodeIds.has(edge.to)
    ) {
      connectedSemanticNodeIds.add(
        edge.to,
      );
    }
  }

  const semanticIsolationCount =
    [...semanticNodeIds].filter(
      (nodeId) =>
        !connectedSemanticNodeIds.has(
          nodeId,
        ),
    ).length;

  const semanticEdgeEvidenceCoverage =
    semanticEdges.length === 0
      ? 1
      : semanticEdges.filter(
          (edge) =>
            (edge.evidenceIds?.length ?? 0) >
            0,
        ).length /
        semanticEdges.length;

  const relationshipFactCoverage =
    state.relationshipCandidateCount === 0
      ? 1
      : state.parsedRelationshipCandidateCount /
        state.relationshipCandidateCount;

  const warnings: string[] = [];
  let status:
    KnowledgeGraphQuality["status"] =
      "passed";

  if (semanticNodeIds.size === 0) {
    status = "failed";
    warnings.push(
      "No evidence-grounded semantic nodes were available for the Knowledge Graph.",
    );
  } else {
    if (
      semanticEdgeEvidenceCoverage < 1
    ) {
      status = "warning";
      warnings.push(
        "One or more semantic relationships are missing direct evidence.",
      );
    }

    if (
      state.skippedUnsafeRelationshipCount >
      0
    ) {
      status = "warning";
      warnings.push(
        "Some relationship candidates were omitted because their direction or meaning could not be proven safely.",
      );
    }

    if (
      state.conflictingEdgeCount > 0
    ) {
      status = "warning";
      warnings.push(
        "Conflicting semantic relationship candidates were removed from the Knowledge Graph.",
      );
    }

    if (
      state.omittedUngroundedNodeCount > 0
    ) {
      status = "warning";
      warnings.push(
        "Ungrounded concept or term candidates were omitted from the Knowledge Graph.",
      );
    }

    if (
      state.relationshipCandidateCount >
        0 &&
      relationshipFactCoverage < 0.5
    ) {
      status = "warning";
      warnings.push(
        "Less than half of relationship-bearing facts could be converted into safely directed graph edges.",
      );
    }
  }

  return {
    status,
    semanticNodeCount:
      semanticNodeIds.size,
    semanticEdgeCount:
      semanticEdges.length,
    semanticIsolationCount,
    semanticEdgeEvidenceCoverage:
      roundRatio(
        semanticEdgeEvidenceCoverage,
      ),
    relationshipFactCoverage:
      roundRatio(
        relationshipFactCoverage,
      ),
    duplicateEdgeCount:
      state.duplicateEdgeCount,
    conflictingEdgeCount:
      state.conflictingEdgeCount,
    skippedUnsafeRelationshipCount:
      state.skippedUnsafeRelationshipCount,
    omittedUngroundedNodeCount:
      state.omittedUngroundedNodeCount,
    warnings,
  };
}

function factNode(
  fact: AtomicFact,
  learningOrder: number,
): GraphNodeData {
  return {
    id: fact.id,
    type:
      fact.type === "result"
        ? "result"
        : fact.type ===
            "procedure_step"
          ? "method"
          : "claim",
    label: shorten(
      fact.content,
      120,
    ),
    properties: {
      description: fact.content,
      confidence: fact.confidence,
      score: fact.importanceScore,
      factType: fact.type,
      sourceSectionId:
        fact.sourceSectionId,
      learningOrder,
      evidence: fact.evidence,
      provenance: "document",
    },
  };
}

function pushNode(
  state: SemanticGraphState,
  node: GraphNodeData,
): void {
  if (
    state.nodesById.has(node.id)
  ) {
    return;
  }

  state.nodes.push(node);
  state.nodesById.set(
    node.id,
    node,
  );
}

function uniqueNodes(
  nodes: GraphNodeData[],
): GraphNodeData[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }
    seen.add(node.id);
    return true;
  });
}

function uniqueEdges(
  edges: GraphEdgeData[],
): GraphEdgeData[] {
  const output =
    new Map<string, GraphEdgeData>();

  for (const edge of edges) {
    const key =
      `${edge.from}:${edge.type}:${edge.to}`;
    const existing =
      output.get(key);

    if (!existing) {
      output.set(key, {
        ...edge,
        ...(edge.evidenceIds
          ? {
              evidenceIds:
                uniqueStrings(
                  edge.evidenceIds,
                ),
            }
          : {}),
      });
      continue;
    }

    existing.weight = Math.max(
      existing.weight,
      edge.weight,
    );

    if (
      edge.evidenceIds ||
      existing.evidenceIds
    ) {
      existing.evidenceIds =
        uniqueStrings([
          ...(existing.evidenceIds ??
            []),
          ...(edge.evidenceIds ?? []),
        ]);
    }
  }

  return [...output.values()];
}

function relationshipWeight(
  fact: AtomicFact,
): number {
  return Math.min(
    1,
    Math.max(
      0,
      (
        fact.confidence +
        fact.importanceScore
      ) / 2,
    ),
  );
}

function uniqueEvidence(
  evidence: unknown[],
): unknown[] {
  const output: unknown[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      output.push(item);
      continue;
    }

    const raw =
      item as Record<string, unknown>;
    const id =
      typeof raw.id === "string"
        ? raw.id
        : JSON.stringify(item);

    if (seen.has(id)) continue;
    seen.add(id);
    output.push(item);
  }

  return output;
}

function asFiniteNumber(
  value: unknown,
): number | undefined {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : undefined;
}

function isAcronymAlias(
  left: string,
  right: string,
): boolean {
  const leftCompact = normalise(left)
    .replace(/\s+/g, "");
  const rightCompact = normalise(right)
    .replace(/\s+/g, "");
  const leftInitialism =
    initialism(left);
  const rightInitialism =
    initialism(right);

  return Boolean(
    (
      leftCompact.length >= 2 &&
      leftCompact ===
        rightInitialism
    ) ||
    (
      rightCompact.length >= 2 &&
      rightCompact ===
        leftInitialism
    ),
  );
}

function initialism(
  value: string,
): string {
  const words =
    value
      .normalize("NFKC")
      .match(
        /[\p{L}\p{N}]+/gu,
      ) ?? [];

  if (words.length < 2) {
    return "";
  }

  return words
    .map((word) => word[0] ?? "")
    .join("")
    .toLocaleLowerCase();
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (value) =>
          value.trim().length > 0,
      ),
    ),
  ];
}

function roundRatio(
  value: number,
): number {
  return (
    Math.round(value * 1000) /
    1000
  );
}

function cleanHeading(
  value: string,
): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(
      /\s*\(\s*insert\s+(?:a\s+)?(?:class\s+)?(?:diagram|image|figure|chart)\s*\)\s*/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(
  value: string,
  maxLength: number,
): string {
  const text =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (
    text.length <= maxLength
  ) {
    return text;
  }

  return `${text
    .slice(0, maxLength - 1)
    .trimEnd()}…`;
}

function safeId(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(0, 64) || "item";
}

function normalise(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}\p{M} ]+/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

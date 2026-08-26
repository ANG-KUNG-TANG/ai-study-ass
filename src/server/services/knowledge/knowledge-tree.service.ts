import type {
  AtomicFact,
  GroundedKnowledge,
  ImportantConcept,
  QualifiedTerm,
} from "@/server/intelligence/grounding";
import type {
  KnowledgeTreeData,
  KnowledgeTreeNodeData,
  KnowledgeTreeNodeType,
  KnowledgeTreeQualityStatus,
} from "@/server/types/Knowledge";

const VISIBLE_SECTION_STATUSES = new Set([
  "covered",
  "no_extractable_knowledge",
]);

const MIN_CONCEPT_IMPORTANCE = 0.45;
const MAJOR_CONCEPT_IMPORTANCE = 0.65;
const MIN_FACT_IMPORTANCE = 0.78;
const MAX_EXPLICIT_HIERARCHY_DEPTH = 3;

interface MutableTreeNode
  extends Omit<KnowledgeTreeNodeData, "children"> {
  parentId: string | null;
  childIds: string[];
}

interface CanonicalItem {
  nodeId: string;
  aliases: Set<string>;
}

interface BuildState {
  nodes: Map<string, MutableTreeNode>;
  canonicalItems: Map<string, CanonicalItem>;
  aliasToNodeId: Map<string, string>;
  visibleSections: Map<string, GroundedKnowledge["sections"][number]>;
  duplicateAliasCount: number;
  explicitHierarchyCount: number;
  skippedHierarchyCount: number;
  omittedUngroundedCount: number;
}

export function buildGroundedKnowledgeTree(
  grounding: GroundedKnowledge,
): KnowledgeTreeData {
  const root = makeRoot();
  const state: BuildState = {
    nodes: new Map([[root.id, root]]),
    canonicalItems: new Map(),
    aliasToNodeId: new Map(),
    visibleSections: new Map(
      grounding.sections
        .filter((section) =>
          VISIBLE_SECTION_STATUSES.has(section.status),
        )
        .map((section) => [section.sectionId, section]),
    ),
    duplicateAliasCount: 0,
    explicitHierarchyCount: 0,
    skippedHierarchyCount: 0,
    omittedUngroundedCount: 0,
  };

  const majorConcepts = grounding.concepts.filter(
    (concept) =>
      concept.importanceScore >= MAJOR_CONCEPT_IMPORTANCE,
  );

  addConcepts(state, grounding.concepts);
  addTerms(state, grounding.keyTerms);
  addImportantFacts(state, grounding.facts);
  applyExplicitHierarchy(state, grounding.facts);
  removeEmptyTopics(state);
  sortChildren(state);

  const materializedRoot = materializeTree(
    root.id,
    state.nodes,
    new Set(),
  );

  const includedMajorConcepts = majorConcepts.filter((concept) =>
    findCanonicalNodeId(state, concept.name) !== null,
  ).length;
  const majorConceptCoverage =
    majorConcepts.length === 0
      ? 1
      : includedMajorConcepts / majorConcepts.length;

  const orphanCount = countOrphans(state);
  const knowledgeItemCount = [...state.nodes.values()].filter(
    (node) =>
      node.type === "concept" ||
      node.type === "term" ||
      node.type === "fact",
  ).length;
  const maxDepth = materializedRoot
    ? measureDepth(materializedRoot)
    : 0;

  const quality = buildQuality({
    knowledgeItemCount,
    majorConceptCoverage,
    orphanCount,
    duplicateAliasCount: state.duplicateAliasCount,
    explicitHierarchyCount: state.explicitHierarchyCount,
    skippedHierarchyCount: state.skippedHierarchyCount,
    omittedUngroundedCount: state.omittedUngroundedCount,
    maxDepth,
  });

  return {
    root: materializedRoot,
    quality,
  };
}

function makeRoot(): MutableTreeNode {
  return {
    id: "knowledge-root",
    type: "root",
    label: "Knowledge",
    description:
      "Evidence-grounded knowledge extracted from the uploaded document.",
    importance: null,
    sourceSectionIds: [],
    evidenceIds: [],
    graphNodeId: "grounded-document",
    relationToParent: "root",
    relationEvidenceIds: [],
    parentId: null,
    childIds: [],
  };
}

function addConcepts(
  state: BuildState,
  concepts: ImportantConcept[],
): void {
  concepts.forEach((concept, index) => {
    if (
      concept.importanceScore < MIN_CONCEPT_IMPORTANCE ||
      concept.evidence.length === 0
    ) {
      if (concept.importanceScore >= MAJOR_CONCEPT_IMPORTANCE) {
        state.omittedUngroundedCount += 1;
      }
      return;
    }

    const conceptId =
      `grounded-concept-${safeId(concept.normalizedName)}-${index + 1}`;
    const sourceSectionIds = uniqueStrings([
      ...concept.sourceSectionIds,
      ...concept.evidence.map((evidence) => evidence.sectionId),
    ]);

    const node: MutableTreeNode = {
      id: conceptId,
      type: "concept",
      label: concept.name,
      description: concept.explanation,
      importance: concept.importanceScore,
      sourceSectionIds,
      evidenceIds: uniqueStrings(
        concept.evidence.map((evidence) => evidence.id),
      ),
      graphNodeId: conceptId,
      relationToParent: "topic_group",
      relationEvidenceIds: [],
      parentId: null,
      childIds: [],
    };

    state.nodes.set(node.id, node);
    registerCanonicalItem(state, node.id, concept.name);
    attachToPrimaryTopic(state, node.id, sourceSectionIds);
  });
}

function addTerms(
  state: BuildState,
  terms: QualifiedTerm[],
): void {
  terms.forEach((term, index) => {
    if (term.evidence.length === 0) {
      state.omittedUngroundedCount += 1;
      return;
    }

    const existingId = findCanonicalNodeId(state, term.term);
    if (existingId) {
      mergeTermIntoNode(
        state,
        existingId,
        term,
      );
      state.duplicateAliasCount += 1;
      return;
    }

    const nodeId =
      `knowledge-term-${safeId(term.term)}-${index + 1}`;
    const sourceSectionIds = uniqueStrings([
      term.sourceSectionId,
      ...term.evidence.map((evidence) => evidence.sectionId),
    ]);

    const node: MutableTreeNode = {
      id: nodeId,
      type: "term",
      label: term.term,
      description: term.definition,
      importance: term.confidence,
      sourceSectionIds,
      evidenceIds: uniqueStrings(
        term.evidence.map((evidence) => evidence.id),
      ),
      graphNodeId: null,
      relationToParent: "topic_group",
      relationEvidenceIds: [],
      parentId: null,
      childIds: [],
    };

    state.nodes.set(node.id, node);
    registerCanonicalItem(state, node.id, term.term);
    attachToPrimaryTopic(state, node.id, sourceSectionIds);
  });
}

function addImportantFacts(
  state: BuildState,
  facts: AtomicFact[],
): void {
  for (const fact of facts) {
    if (
      fact.verificationStatus !== "supported" ||
      fact.importanceScore < MIN_FACT_IMPORTANCE
    ) {
      continue;
    }

    if (fact.evidence.length === 0) {
      state.omittedUngroundedCount += 1;
      continue;
    }

    const mentionedKnowledgeIds = findMentionedCanonicalNodeIds(
      state,
      fact.content,
    );

    const parentId =
      mentionedKnowledgeIds.length === 1
        ? mentionedKnowledgeIds[0]!
        : ensureTopic(state, fact.sourceSectionId);

    const node: MutableTreeNode = {
      id: fact.id,
      type: "fact",
      label: shorten(fact.content, 120),
      description: fact.content,
      importance: fact.importanceScore,
      sourceSectionIds: [fact.sourceSectionId],
      evidenceIds: uniqueStrings(
        fact.evidence.map((evidence) => evidence.id),
      ),
      graphNodeId: fact.id,
      relationToParent:
        mentionedKnowledgeIds.length === 1
          ? "supporting_fact"
          : "topic_group",
      relationEvidenceIds: uniqueStrings(
        fact.evidence.map((evidence) => evidence.id),
      ),
      parentId,
      childIds: [],
    };

    state.nodes.set(node.id, node);
    attachChild(state, parentId, node.id);
  }
}

function applyExplicitHierarchy(
  state: BuildState,
  facts: AtomicFact[],
): void {
  for (const fact of facts) {
    if (
      fact.verificationStatus !== "supported" ||
      fact.evidence.length === 0 ||
      (
        fact.type !== "relationship" &&
        fact.type !== "definition"
      )
    ) {
      continue;
    }

    const candidates = findMentionedCanonicalNodeIds(
      state,
      fact.content,
    );

    if (candidates.length < 2) continue;

    const direction = inferHierarchyDirection(
      fact.content,
      candidates,
      state,
    );

    if (!direction) continue;

    const parent = state.nodes.get(direction.parentId);
    const child = state.nodes.get(direction.childId);
    if (!parent || !child) continue;

    if (
      !isSemanticNode(parent.type) ||
      !isSemanticNode(child.type) ||
      child.parentId === parent.id
    ) {
      continue;
    }

    if (
      child.relationToParent === "explicit_hierarchy" ||
      wouldCreateCycle(
        state.nodes,
        parent.id,
        child.id,
      ) ||
      nodeDepth(state.nodes, parent.id) >=
        MAX_EXPLICIT_HIERARCHY_DEPTH
    ) {
      state.skippedHierarchyCount += 1;
      continue;
    }

    if (child.parentId) {
      detachChild(
        state,
        child.parentId,
        child.id,
      );
    }

    child.parentId = parent.id;
    child.relationToParent = "explicit_hierarchy";
    child.relationEvidenceIds = uniqueStrings(
      fact.evidence.map((evidence) => evidence.id),
    );
    attachChild(state, parent.id, child.id);
    state.explicitHierarchyCount += 1;
  }
}

function inferHierarchyDirection(
  content: string,
  candidateIds: string[],
  state: BuildState,
): {
  parentId: string;
  childId: string;
} | null {
  const text = normalise(content);

  for (const childId of candidateIds) {
    for (const parentId of candidateIds) {
      if (childId === parentId) continue;

      const child = state.nodes.get(childId);
      const parent = state.nodes.get(parentId);
      if (!child || !parent) continue;

      const childLabel = normalise(child.label);
      const parentLabel = normalise(parent.label);
      if (!childLabel || !parentLabel) continue;

      if (
        matchesChildOfParent(
          text,
          childLabel,
          parentLabel,
        ) ||
        matchesParentContainsChild(
          text,
          parentLabel,
          childLabel,
        )
      ) {
        return {
          parentId,
          childId,
        };
      }
    }
  }

  return null;
}

function matchesChildOfParent(
  text: string,
  child: string,
  parent: string,
): boolean {
  const childIndex = text.indexOf(child);
  const parentIndex = text.indexOf(
    parent,
    childIndex + child.length,
  );

  if (
    childIndex < 0 ||
    parentIndex < 0 ||
    parentIndex <= childIndex
  ) {
    return false;
  }

  const between = text.slice(
    childIndex + child.length,
    parentIndex,
  );

  return /\b(?:is|are)\s+(?:a\s+|an\s+|the\s+)?(?:type|kind|form|subtype|category|part|component)\s+of\b/u.test(
    between,
  );
}

function matchesParentContainsChild(
  text: string,
  parent: string,
  child: string,
): boolean {
  const parentIndex = text.indexOf(parent);
  const childIndex = text.indexOf(
    child,
    parentIndex + parent.length,
  );

  if (
    parentIndex < 0 ||
    childIndex < 0 ||
    childIndex <= parentIndex
  ) {
    return false;
  }

  const between = text.slice(
    parentIndex + parent.length,
    childIndex,
  );

  return /\b(?:includes?|contains?|comprises?|consists?\s+of|is\s+composed\s+of|are\s+composed\s+of)\b/u.test(
    between,
  );
}

function attachToPrimaryTopic(
  state: BuildState,
  nodeId: string,
  sourceSectionIds: string[],
): void {
  const primarySectionId =
    sourceSectionIds.find((sectionId) =>
      state.visibleSections.has(sectionId),
    ) ?? null;
  const topicId = primarySectionId
    ? ensureTopic(state, primarySectionId)
    : ensureOtherTopic(state);

  const node = state.nodes.get(nodeId);
  if (!node) return;

  node.parentId = topicId;
  attachChild(state, topicId, nodeId);
}

function ensureTopic(
  state: BuildState,
  sectionId: string,
): string {
  const topicId = `knowledge-topic-${safeId(sectionId)}`;
  if (state.nodes.has(topicId)) return topicId;

  const section = state.visibleSections.get(sectionId);
  if (!section) {
    return ensureOtherTopic(state);
  }

  const node: MutableTreeNode = {
    id: topicId,
    type: "topic",
    label: cleanHeading(section.heading),
    description:
      "A source-grounded topic grouping for concepts and important facts from this section.",
    importance: null,
    sourceSectionIds: [section.sectionId],
    evidenceIds: [],
    graphNodeId: section.sectionId,
    relationToParent: "topic_group",
    relationEvidenceIds: [],
    parentId: "knowledge-root",
    childIds: [],
  };

  state.nodes.set(node.id, node);
  attachChild(state, "knowledge-root", node.id);
  return node.id;
}

function ensureOtherTopic(
  state: BuildState,
): string {
  const topicId = "knowledge-topic-other";
  if (state.nodes.has(topicId)) return topicId;

  const node: MutableTreeNode = {
    id: topicId,
    type: "topic",
    label: "Other grounded knowledge",
    description:
      "Grounded knowledge that is not attached to a visible source topic.",
    importance: null,
    sourceSectionIds: [],
    evidenceIds: [],
    graphNodeId: null,
    relationToParent: "topic_group",
    relationEvidenceIds: [],
    parentId: "knowledge-root",
    childIds: [],
  };

  state.nodes.set(node.id, node);
  attachChild(state, "knowledge-root", node.id);
  return node.id;
}

function registerCanonicalItem(
  state: BuildState,
  nodeId: string,
  label: string,
): void {
  const normalised = normalise(label);
  if (!normalised) return;

  const aliases = new Set<string>([normalised]);
  const acronym = initialism(label);
  if (acronym.length >= 2) aliases.add(acronym);

  state.canonicalItems.set(nodeId, {
    nodeId,
    aliases,
  });

  for (const alias of aliases) {
    if (!state.aliasToNodeId.has(alias)) {
      state.aliasToNodeId.set(alias, nodeId);
    }
  }
}

function mergeTermIntoNode(
  state: BuildState,
  nodeId: string,
  term: QualifiedTerm,
): void {
  const node = state.nodes.get(nodeId);
  const item = state.canonicalItems.get(nodeId);
  if (!node || !item) return;

  node.sourceSectionIds = uniqueStrings([
    ...node.sourceSectionIds,
    term.sourceSectionId,
    ...term.evidence.map((evidence) => evidence.sectionId),
  ]);
  node.evidenceIds = uniqueStrings([
    ...node.evidenceIds,
    ...term.evidence.map((evidence) => evidence.id),
  ]);

  if (!node.description && term.definition) {
    node.description = term.definition;
  }

  const aliases = [
    normalise(term.term),
    initialism(term.term),
  ].filter((value) => value.length >= 2);

  for (const alias of aliases) {
    item.aliases.add(alias);
    if (!state.aliasToNodeId.has(alias)) {
      state.aliasToNodeId.set(alias, nodeId);
    }
  }
}

function findCanonicalNodeId(
  state: BuildState,
  label: string,
): string | null {
  const normalised = normalise(label);
  if (!normalised) return null;

  const exact = state.aliasToNodeId.get(normalised);
  if (exact) return exact;

  const acronym = initialism(label);
  if (acronym.length >= 2) {
    const acronymMatch = state.aliasToNodeId.get(acronym);
    if (acronymMatch) return acronymMatch;
  }

  for (const [nodeId, item] of state.canonicalItems) {
    const node = state.nodes.get(nodeId);
    if (!node) continue;

    if (isAcronymAlias(label, node.label)) {
      return item.nodeId;
    }
  }

  return null;
}

function findMentionedCanonicalNodeIds(
  state: BuildState,
  content: string,
): string[] {
  const text = normalise(content);
  const matches: string[] = [];

  for (const [nodeId, item] of state.canonicalItems) {
    if (
      [...item.aliases].some(
        (alias) =>
          alias.length >= 3 &&
          containsTokenSequence(text, alias),
      )
    ) {
      matches.push(nodeId);
    }
  }

  return uniqueStrings(matches);
}

function containsTokenSequence(
  text: string,
  phrase: string,
): boolean {
  if (!phrase) return false;

  const escaped = phrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`,
    "u",
  ).test(text);
}

function isAcronymAlias(
  left: string,
  right: string,
): boolean {
  const leftCompact = normalise(left).replace(/\s+/g, "");
  const rightCompact = normalise(right).replace(/\s+/g, "");
  const leftInitialism = initialism(left);
  const rightInitialism = initialism(right);

  return Boolean(
    (
      leftCompact.length >= 2 &&
      leftCompact === rightInitialism
    ) ||
    (
      rightCompact.length >= 2 &&
      rightCompact === leftInitialism
    ),
  );
}

function initialism(value: string): string {
  const words =
    value.normalize("NFKC").match(
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

function attachChild(
  state: BuildState,
  parentId: string,
  childId: string,
): void {
  const parent = state.nodes.get(parentId);
  if (!parent) return;

  if (!parent.childIds.includes(childId)) {
    parent.childIds.push(childId);
  }
}

function detachChild(
  state: BuildState,
  parentId: string,
  childId: string,
): void {
  const parent = state.nodes.get(parentId);
  if (!parent) return;

  parent.childIds = parent.childIds.filter(
    (id) => id !== childId,
  );
}

function wouldCreateCycle(
  nodes: Map<string, MutableTreeNode>,
  parentId: string,
  childId: string,
): boolean {
  let cursor: string | null = parentId;
  const visited = new Set<string>();

  while (cursor) {
    if (cursor === childId) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = nodes.get(cursor)?.parentId ?? null;
  }

  return false;
}

function nodeDepth(
  nodes: Map<string, MutableTreeNode>,
  nodeId: string,
): number {
  let depth = 0;
  let cursor = nodes.get(nodeId)?.parentId ?? null;
  const visited = new Set<string>();

  while (cursor) {
    if (visited.has(cursor)) break;
    visited.add(cursor);
    depth += 1;
    cursor = nodes.get(cursor)?.parentId ?? null;
  }

  return depth;
}

function removeEmptyTopics(
  state: BuildState,
): void {
  const root = state.nodes.get("knowledge-root");
  if (!root) return;

  for (const childId of [...root.childIds]) {
    const child = state.nodes.get(childId);
    if (
      child?.type === "topic" &&
      child.childIds.length === 0
    ) {
      root.childIds = root.childIds.filter(
        (id) => id !== childId,
      );
      state.nodes.delete(childId);
    }
  }
}

function sortChildren(
  state: BuildState,
): void {
  const sectionOrder = new Map(
    [...state.visibleSections.keys()].map(
      (sectionId, index) => [sectionId, index],
    ),
  );

  for (const node of state.nodes.values()) {
    node.childIds.sort((leftId, rightId) => {
      const left = state.nodes.get(leftId);
      const right = state.nodes.get(rightId);
      if (!left || !right) return 0;

      if (
        left.type === "topic" &&
        right.type === "topic"
      ) {
        const leftSection =
          left.sourceSectionIds[0] ?? "";
        const rightSection =
          right.sourceSectionIds[0] ?? "";

        return (
          (sectionOrder.get(leftSection) ?? 9999) -
          (sectionOrder.get(rightSection) ?? 9999)
        );
      }

      return (
        typeRank(left.type) - typeRank(right.type) ||
        (right.importance ?? 0) -
          (left.importance ?? 0) ||
        left.label.localeCompare(right.label)
      );
    });
  }
}

function typeRank(type: KnowledgeTreeNodeType): number {
  switch (type) {
    case "concept":
      return 0;
    case "term":
      return 1;
    case "fact":
      return 2;
    case "topic":
      return 3;
    case "root":
      return 4;
  }
}

function materializeTree(
  nodeId: string,
  nodes: Map<string, MutableTreeNode>,
  stack: Set<string>,
): KnowledgeTreeNodeData | null {
  const node = nodes.get(nodeId);
  if (!node || stack.has(nodeId)) return null;

  const nextStack = new Set(stack);
  nextStack.add(nodeId);

  return {
    id: node.id,
    type: node.type,
    label: node.label,
    description: node.description,
    importance: node.importance,
    sourceSectionIds: [...node.sourceSectionIds],
    evidenceIds: [...node.evidenceIds],
    graphNodeId: node.graphNodeId,
    relationToParent: node.relationToParent,
    relationEvidenceIds: [
      ...node.relationEvidenceIds,
    ],
    children: node.childIds
      .map((childId) =>
        materializeTree(
          childId,
          nodes,
          nextStack,
        ),
      )
      .filter(
        (
          child,
        ): child is KnowledgeTreeNodeData =>
          child !== null,
      ),
  };
}

function countOrphans(
  state: BuildState,
): number {
  const reachable = new Set<string>();
  const visit = (nodeId: string): void => {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);

    for (
      const childId of
      state.nodes.get(nodeId)?.childIds ?? []
    ) {
      visit(childId);
    }
  };

  visit("knowledge-root");

  return [...state.nodes.values()].filter(
    (node) =>
      node.type !== "root" &&
      !reachable.has(node.id),
  ).length;
}

function measureDepth(
  node: KnowledgeTreeNodeData,
): number {
  if (node.children.length === 0) return 0;

  return (
    1 +
    Math.max(
      ...node.children.map(measureDepth),
    )
  );
}

function buildQuality(input: {
  knowledgeItemCount: number;
  majorConceptCoverage: number;
  orphanCount: number;
  duplicateAliasCount: number;
  explicitHierarchyCount: number;
  skippedHierarchyCount: number;
  omittedUngroundedCount: number;
  maxDepth: number;
}): KnowledgeTreeData["quality"] {
  const warnings: string[] = [];
  let status: KnowledgeTreeQualityStatus = "passed";

  if (input.knowledgeItemCount === 0) {
    status = "failed";
    warnings.push(
      "No evidence-grounded knowledge items were available for the tree.",
    );
  } else {
    if (input.majorConceptCoverage < 0.85) {
      status = "warning";
      warnings.push(
        "Major-concept coverage is below the Knowledge Tree target.",
      );
    }

    if (input.orphanCount > 0) {
      status = "warning";
      warnings.push(
        "One or more knowledge nodes could not be connected safely.",
      );
    }

    if (input.skippedHierarchyCount > 0) {
      status = "warning";
      warnings.push(
        "Some candidate hierarchy relationships were omitted because they would create ambiguity, excessive depth, or a cycle.",
      );
    }

    if (input.omittedUngroundedCount > 0) {
      status = "warning";
      warnings.push(
        "Ungrounded concept or term candidates were omitted from the Knowledge Tree.",
      );
    }

    if (input.maxDepth > 4) {
      status = "warning";
      warnings.push(
        "The Knowledge Tree exceeded the preferred conceptual depth.",
      );
    }
  }

  return {
    status,
    majorConceptCoverage:
      Math.round(input.majorConceptCoverage * 1000) /
      1000,
    orphanCount: input.orphanCount,
    duplicateAliasCount: input.duplicateAliasCount,
    explicitHierarchyCount:
      input.explicitHierarchyCount,
    skippedHierarchyCount:
      input.skippedHierarchyCount,
    omittedUngroundedCount:
      input.omittedUngroundedCount,
    maxDepth: input.maxDepth,
    warnings,
  };
}

function isSemanticNode(
  type: KnowledgeTreeNodeType,
): boolean {
  return type === "concept" || type === "term";
}

function uniqueStrings(
  values: string[],
): string[] {
  return [...new Set(
    values.filter((value) => value.trim()),
  )];
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(
  value: string,
  maxLength: number,
): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  return `${text
    .slice(0, maxLength - 1)
    .trimEnd()}…`;
}

function safeId(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

import type {
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type {
  GraphData,
  KnowledgeGraphQuality,
  KnowledgeTreeData,
} from "@/server/types/Knowledge";
import {
  buildFeatureQualityReport,
  qualityRatio,
  type FeatureQualityContractReport,
} from "@/server/services/quality/feature-quality.contract";
import {
  buildLearningEvidenceProfile,
} from "@/server/services/quality/learning-evidence.service";

export function assessKnowledgeQualityContract(input: {
  grounding: GroundedKnowledge;
  graph: GraphData;
  graphQuality: KnowledgeGraphQuality;
  tree: KnowledgeTreeData;
}): FeatureQualityContractReport {
  const { grounding, graph, graphQuality, tree } = input;
  const profile = buildLearningEvidenceProfile(grounding);
  const semanticNodes = graph.nodes.filter((node) =>
    node.type === "concept" || node.type === "term",
  );
  const conceptKeys = new Set(
    profile.concepts.map((concept) => normalise(concept.name)),
  );
  const termKeys = new Set(
    profile.keyTerms.map((term) => normalise(term.term)),
  );
  const relevantNodes = semanticNodes.filter((node) => {
    const key = normalise(node.label);
    return conceptKeys.has(key) || termKeys.has(key);
  });
  const semanticPrecision = qualityRatio(
    relevantNodes.length,
    semanticNodes.length,
    1,
  );
  const conceptCoverage = qualityRatio(
    profile.concepts.filter((concept) =>
      semanticNodes.some((node) => normalise(node.label) === normalise(concept.name)),
    ).length,
    profile.concepts.length,
    1,
  );
  const relationGrounding = graphQuality.semanticEdgeCount > 0
    ? graphQuality.semanticEdgeEvidenceCoverage
    : 1;
  const hierarchyQuality = tree.quality
    ? Math.max(
        0,
        1 -
          Math.min(0.45, tree.quality.orphanCount * 0.08) -
          Math.min(0.25, tree.quality.duplicateAliasCount * 0.08),
      )
    : 0;
  const relationSafety = Math.max(
    0,
    1 -
      Math.min(0.5, graphQuality.conflictingEdgeCount * 0.2) -
      Math.min(0.3, graphQuality.skippedUnsafeRelationshipCount * 0.05),
  );
  const ungroundedPublishedNodeCount = semanticNodes.filter((node) => {
    const evidence = node.properties?.evidence;
    return !Array.isArray(evidence) || evidence.length === 0;
  }).length;
  const nodeGrounding = qualityRatio(
    Math.max(0, semanticNodes.length - ungroundedPublishedNodeCount),
    semanticNodes.length,
    1,
  );
  const labelQuality = qualityRatio(
    semanticNodes.filter((node) => isKnowledgeLabelEligible(node.label)).length,
    semanticNodes.length,
    1,
  );

  return buildFeatureQualityReport({
    feature: "knowledge",
    dimensions: [
      { key: "conceptPrecision", label: "Concept precision", weight: 2.0, ratio: semanticPrecision },
      { key: "conceptCoverage", label: "Major concept coverage", weight: 1.75, ratio: Math.min(conceptCoverage, tree.quality?.majorConceptCoverage ?? 1) },
      { key: "relationshipGrounding", label: "Relationship grounding", weight: 1.75, ratio: relationGrounding },
      { key: "hierarchyQuality", label: "Hierarchy quality", weight: 1.25, ratio: hierarchyQuality },
      { key: "relationshipSafety", label: "Relationship safety", weight: 1.25, ratio: relationSafety },
      { key: "nodeGrounding", label: "Node grounding", weight: 1.0, ratio: nodeGrounding },
      { key: "labelQuality", label: "Semantic label quality", weight: 0.75, ratio: labelQuality },
      { key: "duplicateControl", label: "Duplicate control", weight: 0.25, ratio: tree.quality?.duplicateAliasCount ? Math.max(0, 1 - tree.quality.duplicateAliasCount * 0.1) : 1 },
    ],
    hardGates: [
      {
        code: "NO_UNGROUNDED_SEMANTIC_NODES",
        message: "Every published knowledge concept or term must have document evidence.",
        passed: ungroundedPublishedNodeCount === 0,
      },
      {
        code: "NO_UNSAFE_RELATIONSHIPS_PUBLISHED",
        message: "Unsafe or contradictory relationship candidates must be removed before publication.",
        passed: graphQuality.status !== "failed",
      },
      {
        code: "RELATIONSHIPS_REQUIRE_EVIDENCE",
        message: "Every semantic relationship must carry supporting evidence.",
        passed: graphQuality.semanticEdgeCount === 0 || graphQuality.semanticEdgeEvidenceCoverage >= 0.999,
      },
    ],
    warnings: [
      ...(tree.quality?.warnings ?? []),
      ...graphQuality.warnings,
    ],
  });
}

function isKnowledgeLabelEligible(label: string): boolean {
  const value = label.trim();
  if (!value || /^(?:document|there|name|address|what|step\s*\d+|stage\s*\d+|test\s*\d+)$/iu.test(value)) {
    return false;
  }
  return !/[?!.]$/u.test(value);
}

function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

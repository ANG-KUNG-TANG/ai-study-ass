import type {
  ConfidenceBreakdown,
  KnowledgeCore,
  KnowledgeGap,
  KnowledgeGraph,
  NLPResult,
  ResolvedConcept,
} from "../types";

const WEIGHTS = {
  grounding: 0.24,
  numericValidation: 0.18,
  consistency: 0.14,
  sectionCoverage: 0.14,
  conceptQuality: 0.1,
  ontology: 0.06,
  graph: 0.06,
  reasoning: 0.08,
} as const;

const REQUIREMENTS_WEIGHTS = {
  grounding: 0.28,
  numericValidation: 0.04,
  consistency: 0.18,
  sectionCoverage: 0.2,
  conceptQuality: 0.16,
  ontology: 0.04,
  graph: 0.08,
  reasoning: 0.02,
} as const;

export interface ConfidenceInputs {
  nlp: NLPResult;
  ontology: ResolvedConcept[];
  graph: KnowledgeGraph;
  core: KnowledgeCore;
  prologAnswerCount: number;
  gaps: KnowledgeGap;
}

export function computeConfidenceBreakdown(
  inputs: ConfidenceInputs,
): ConfidenceBreakdown {
  const grounding = clamp(inputs.core.validation.groundedClaimRatio);
  const numericValidation = clamp(inputs.core.validation.numericClaimRatio);
  const consistency = clamp(inputs.core.validation.consistencyScore);
  const sectionCoverage = clamp(inputs.gaps.coverageScore);
  const conceptQuality = scoreConceptQuality(inputs.core);
  const isRequirementsDocument = inputs.core.documentProfile.subtype === "business_requirements_document";
  const ontology = scoreOntology(inputs.ontology, isRequirementsDocument);
  const graph = scoreGraph(inputs.graph, inputs.core);
  const reasoning = isRequirementsDocument && inputs.prologAnswerCount === 0
    ? 0.75
    : Math.min(1, inputs.prologAnswerCount / 8);
  const weights = isRequirementsDocument ? REQUIREMENTS_WEIGHTS : WEIGHTS;

  const overall =
    grounding * weights.grounding +
    numericValidation * weights.numericValidation +
    consistency * weights.consistency +
    sectionCoverage * weights.sectionCoverage +
    conceptQuality * weights.conceptQuality +
    ontology * weights.ontology +
    graph * weights.graph +
    reasoning * weights.reasoning;

  return {
    grounding,
    numericValidation,
    consistency,
    sectionCoverage,
    conceptQuality,
    ontology,
    graph,
    reasoning,
    overall,
    overallOutOf10: overall * 10,
    nlp: (grounding + conceptQuality) / 2,
    prolog: reasoning,
    coverage: sectionCoverage,
  };
}

function scoreConceptQuality(core: KnowledgeCore): number {
  if (core.concepts.length === 0) return 0;
  const valid = core.concepts.filter((concept) => concept.valid);
  const qualityRatio = valid.length / core.concepts.length;
  const strongConcepts = valid.filter(
    (concept) => concept.occurrences >= 2 && concept.evidence.length > 0,
  ).length;
  return clamp(qualityRatio * 0.65 + Math.min(1, strongConcepts / 8) * 0.35);
}

function scoreOntology(ontology: ResolvedConcept[], documentLocalIsExpected = false): number {
  if (ontology.length === 0) return documentLocalIsExpected ? 0.7 : 0.4;
  const weighted = ontology.reduce((sum, resolution) => {
    if (resolution.matchType === "unknown") return sum + (documentLocalIsExpected ? 0.7 : 0.35);
    if (resolution.matchType === "generated") return sum + 0.65;
    return sum + resolution.confidence;
  }, 0);
  return clamp(weighted / ontology.length);
}

function scoreGraph(graph: KnowledgeGraph, core: KnowledgeCore): number {
  const validClaims = core.claims.filter((claim) => claim.validationStatus === "valid");
  if (validClaims.length === 0) return 0;
  const claimNodes = [...graph.nodes.values()].filter((node) => node.type === "claim" || node.type === "result").length;
  const evidenceEdges = graph.edges.filter((edge) => edge.evidenceIds && edge.evidenceIds.length > 0).length;
  const claimCoverage = Math.min(1, claimNodes / validClaims.length);
  const evidenceCoverage = Math.min(1, evidenceEdges / Math.max(1, validClaims.length));
  return clamp(claimCoverage * 0.65 + evidenceCoverage * 0.35);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

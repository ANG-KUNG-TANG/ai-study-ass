import type {
  AtomicFact,
  GroundedKnowledge,
} from "@/server/intelligence/grounding";
import type { GraphData } from "@/server/types/Knowledge";

const VISIBLE_SECTION_STATUSES = new Set([
  "covered",
  "no_extractable_knowledge",
]);

export function buildGroundedKnowledgeGraph(
  grounding: GroundedKnowledge,
): GraphData {
  const nodes: GraphData["nodes"] = [
    {
      id: "grounded-document",
      type: "paper",
      label: "Document",
      properties: {
        description: "The uploaded document and root of this evidence-grounded knowledge map.",
        confidence: grounding.quality.score,
        provenance: "document",
      },
    },
  ];
  const edges: GraphData["edges"] = [];
  const factsById = new Map(
    grounding.facts
      .filter((fact) => fact.verificationStatus === "supported")
      .map((fact) => [fact.id, fact]),
  );
  const visibleSectionIds = new Set<string>();

  grounding.sections.forEach((section, learningOrder) => {
    if (!VISIBLE_SECTION_STATUSES.has(section.status)) return;

    visibleSectionIds.add(section.sectionId);
    nodes.push({
      id: section.sectionId,
      type: "section",
      label: cleanHeading(section.heading),
      properties: {
        description:
          section.status === "no_extractable_knowledge"
            ? "This source section contains no extractable study facts."
            : "A source-grounded section in the document learning path.",
        learningOrder: learningOrder + 1,
        pageNumber: section.pageStart,
        pageEnd: section.pageEnd,
        factCount: section.factIds.length,
        provenance: "document",
      },
    });
    edges.push({
      from: "grounded-document",
      to: section.sectionId,
      type: "contains",
      weight: 1,
    });

    for (const [factOrder, factId] of section.factIds.entries()) {
      const fact = factsById.get(factId);

      if (!fact) continue;

      nodes.push(factNode(fact, factOrder + 1));
      edges.push({
        from: section.sectionId,
        to: fact.id,
        type: "contains",
        weight: fact.importanceScore,
        evidenceIds: fact.evidence.map((evidence) => evidence.id),
      });
    }
  });

  for (const [conceptIndex, concept] of grounding.concepts.entries()) {
    const conceptId = `grounded-concept-${safeId(concept.normalizedName)}-${conceptIndex + 1}`;

    nodes.push({
      id: conceptId,
      type: "concept",
      label: concept.name,
      properties: {
        explanation: concept.explanation,
        confidence: concept.importanceScore,
        score: concept.importanceScore,
        evidence: concept.evidence,
        provenance: "document",
      },
    });

    for (const sectionId of concept.sourceSectionIds) {
      if (!visibleSectionIds.has(sectionId)) continue;

      edges.push({
        from: sectionId,
        to: conceptId,
        type: "mentions",
        weight: concept.importanceScore,
        evidenceIds: concept.evidence.map((evidence) => evidence.id),
      });
    }
  }

  return {
    nodes: uniqueNodes(nodes),
    edges: uniqueEdges(edges),
  };
}

function factNode(
  fact: AtomicFact,
  learningOrder: number,
): GraphData["nodes"][number] {
  return {
    id: fact.id,
    type:
      fact.type === "result"
        ? "result"
        : fact.type === "procedure_step"
          ? "method"
          : "claim",
    label: shorten(fact.content, 120),
    properties: {
      description: fact.content,
      confidence: fact.confidence,
      score: fact.importanceScore,
      factType: fact.type,
      sourceSectionId: fact.sourceSectionId,
      learningOrder,
      evidence: fact.evidence,
      provenance: "document",
    },
  };
}

function uniqueNodes(nodes: GraphData["nodes"]): GraphData["nodes"] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function uniqueEdges(edges: GraphData["edges"]): GraphData["edges"] {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.type}:${edge.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanHeading(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(
      /\s*\(\s*insert\s+(?:a\s+)?(?:class\s+)?(?:diagram|image|figure|chart)\s*\)\s*/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

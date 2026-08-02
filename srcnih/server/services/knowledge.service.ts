// server/services/knowledge.service.ts
//
// Knowledge is an API/read-model view over the canonical intelligence result.
// It no longer reads or writes the legacy Knowledge collection.

import * as intelligenceService from "@/server/services/intelligence.service";
import {
  KnowledgeEntity,
  getConfidenceMode,
  type KnowledgeProps,
} from "@/server/entities/knowledge.entity";
import type {
  ConfidenceMode,
  GraphData,
  OntologyMatchRef,
  PipelineStage,
} from "@/server/types/Knowledge";
import type {
  IntelligenceResult,
} from "@/server/intelligence/types";

export type KnowledgeStatus =
  | "not_generated"
  | "ready"
  | "partial"
  | "failed";

export interface KnowledgeView
  extends KnowledgeProps {
  status: KnowledgeStatus;
  mode: ConfidenceMode | null;
}

function asRecord(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function asDate(
  value: unknown,
  fallback = new Date(),
): Date {
  if (value instanceof Date) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed = new Date(value);

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeGraph(
  value: unknown,
): GraphData {
  const raw = asRecord(value);
  const rawNodes = raw.nodes;
  const rawEdges = raw.edges;

  let nodes: GraphData["nodes"] = [];

  if (
    rawNodes instanceof Map
  ) {
    nodes = Array.from(
      rawNodes.values(),
    ) as GraphData["nodes"];
  } else if (
    Array.isArray(rawNodes)
  ) {
    nodes =
      rawNodes as GraphData["nodes"];
  } else if (
    rawNodes &&
    typeof rawNodes === "object"
  ) {
    nodes =
      Object.values(
        rawNodes,
      ) as GraphData["nodes"];
  }

  return {
    nodes,

    edges:
      Array.isArray(rawEdges)
        ? rawEdges as GraphData["edges"]
        : [],
  };
}

function normalizeOntology(
  value: unknown,
): OntologyMatchRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const raw =
        asRecord(entry);

      const concept =
        asRecord(raw.concept);

      const conceptId =
        typeof raw.conceptId === "string"
          ? raw.conceptId
          : typeof concept.id === "string"
            ? concept.id
            : "";

      if (!conceptId) {
        return null;
      }

      const rawMatchType =
        typeof raw.matchType === "string"
          ? raw.matchType
          : "unknown";

      const matchType:
        OntologyMatchRef["matchType"] =
        rawMatchType === "exact" ||
        rawMatchType === "alias" ||
        rawMatchType === "fuzzy"
          ? rawMatchType
          : "unknown";

      return {
        conceptId,

        confidence:
          typeof raw.confidence === "number"
            ? raw.confidence
            : 0,

        matchType,

        rawInput:
          typeof raw.rawInput === "string"
            ? raw.rawInput
            : typeof concept.label === "string"
              ? concept.label
              : "",
      };
    })
    .filter(
      (
        value,
      ): value is OntologyMatchRef =>
        value !== null,
    );
}

function emptyKnowledge(
  noteId: string,
): KnowledgeView {
  const now = new Date();

  return {
    noteId,

    stage:
      "pending" as PipelineStage,

    graph: {
      nodes: [],
      edges: [],
    },

    ontologyMatches:
      [],

    prologFacts:
      [],

    createdAt:
      now,

    updatedAt:
      now,

    status:
      "not_generated",

    mode:
      null,
  };
}

function mapIntelligence(
  noteId: string,
  value: unknown,
): KnowledgeView {
  const raw =
    asRecord(value);

  const stage =
    (
      typeof raw.stage === "string"
        ? raw.stage
        : "pending"
    ) as PipelineStage;

  const confidence =
    typeof raw.confidence === "number"
      ? raw.confidence
      : undefined;

  const processedAt =
    asDate(
      raw.processedAt,
    );

  const error =
    typeof raw.error === "string"
      ? raw.error
      : undefined;

  const isCompleteFunction =
    raw.isComplete;

  const hasFailedFunction =
    raw.hasFailed;

  const complete =
    typeof isCompleteFunction === "function"
      ? Boolean(
          (
            isCompleteFunction as
              () => boolean
          ).call(value),
        )
      : stage === "complete";

  const failed =
    typeof hasFailedFunction === "function"
      ? Boolean(
          (
            hasFailedFunction as
              () => boolean
          ).call(value),
        )
      : Boolean(error);

  const status:
    KnowledgeStatus =
    complete
      ? "ready"
      : failed
        ? "failed"
        : "partial";

  const props: KnowledgeProps = {
    noteId:
      typeof raw.noteId === "string"
        ? raw.noteId
        : noteId,

    stage,

    error,

    core:
      raw.core as
        KnowledgeProps["core"],

    ontologyMatches:
      normalizeOntology(
        raw.ontology ??
        raw.ontologyMatches,
      ),

    graph:
      normalizeGraph(
        raw.graph,
      ),

    prologFacts:
      Array.isArray(raw.facts)
        ? raw.facts as
            NonNullable<
              KnowledgeProps[
                "prologFacts"
              ]
            >
        : Array.isArray(
            raw.prologFacts,
          )
          ? raw.prologFacts as
              NonNullable<
                KnowledgeProps[
                  "prologFacts"
                ]
              >
          : [],

    gaps:
      raw.gaps as
        KnowledgeProps["gaps"],

    confidenceBreakdown:
      raw.confidenceBreakdown as
        KnowledgeProps[
          "confidenceBreakdown"
        ],

    confidence,

    aiFallback:
      raw.aiFallback as
        KnowledgeProps["aiFallback"],

    createdAt:
      processedAt,

    updatedAt:
      processedAt,

    processedAt,
  };

  return {
    ...props,

    status,

    mode:
      confidence === undefined
        ? null
        : getConfidenceMode({
            confidence,
          }),
  };
}

/**
 * Read knowledge without triggering analysis.
 *
 * React development mode may issue duplicate GET requests, so GET must remain
 * side-effect free. Upload and POST /api/notes/[id]/generate own generation.
 */
export async function getKnowledge(
  noteId: string,
): Promise<KnowledgeView> {
  const status =
    await intelligenceService
      .getStatus(noteId);

  if (!status.exists) {
    return emptyKnowledge(
      noteId,
    );
  }

  const result =
    await intelligenceService
      .getResultOrThrow(
        noteId,
      );

  return mapIntelligence(
    noteId,
    result,
  );
}

/**
 * Compatibility alias. Missing intelligence is represented by
 * status "not_generated" instead of null or a 404.
 */
export async function ensureKnowledge(
  noteId: string,
): Promise<KnowledgeView> {
  return getKnowledge(
    noteId,
  );
}

/**
 * Delete the canonical intelligence result.
 */
export async function deleteKnowledge(
  noteId: string,
): Promise<boolean> {
  await intelligenceService
    .deleteForNote(noteId);

  return true;
}

/**
 * Compatibility mapper for older code.
 *
 * This function does not persist to the legacy Knowledge collection. The
 * intelligence pipeline is the only persistence owner.
 */
export async function createKnowledge(
  result: IntelligenceResult,
): Promise<KnowledgeEntity> {
  const mapped =
    mapIntelligence(
      result.noteId,
      {
        ...result,

        stage:
          "complete",

        facts:
          result.prolog.facts,

        processedAt:
          result.processedAt,
      },
    );

  return KnowledgeEntity.create(
    mapped,
  );
}

/**
 * Compatibility helper for older failure paths.
 *
 * Failed intelligence must be persisted by intelligence.service.ts.
 */
export async function createFailedKnowledge(
  noteId: string,
  stage: PipelineStage,
  error: string,
): Promise<KnowledgeEntity> {
  return KnowledgeEntity.create({
    noteId,
    stage,
    error,
  });
}

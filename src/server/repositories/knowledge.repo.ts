import {
  Knowledge,
  type KnowledgeDocument,
} from "@/server/models/Knowledge";
import type {
  IntelligenceResult,
  PipelineStage,
} from "@/server/types/Knowledge";
import {
  KnowledgeEntity,
  type CreateKnowledgeInput,
} from "@/server/entities/knowledge.entity";

export function fromIntelligenceResult(
  result: IntelligenceResult,
): CreateKnowledgeInput {
  return {
    noteId: result.noteId,
    stage: "complete",
    core: result.core,
    ontologyMatches: result.ontology.map((match) => ({
      conceptId: match.concept.id,
      confidence: match.confidence,
      matchType: match.matchType,
      rawInput: match.rawInput,
    })),
    graph: {
      nodes: Array.from(result.graph.nodes.values()),
      edges: result.graph.edges,
    },
    prologFacts: result.prolog.facts,
    gaps: result.gaps,
    confidenceBreakdown: result.confidenceBreakdown,
    confidence: result.confidence,
    aiFallback: result.aiFallback,
    processedAt: result.processedAt,
  };
}

export function toEntity(doc: KnowledgeDocument): KnowledgeEntity {
  return KnowledgeEntity.fromPersistence({
    noteId: String(doc.noteId),
    stage: doc.stage,
    error: doc.error,
    core: doc.core as KnowledgeEntity["core"],
    ontologyMatches: doc.ontologyMatches,
    graph: doc.graph,
    prologFacts: doc.prologFacts,
    gaps: doc.gaps as KnowledgeEntity["gaps"],
    confidenceBreakdown: doc.confidenceBreakdown,
    confidence: doc.confidence,
    aiFallback: doc.aiFallback as KnowledgeEntity["aiFallback"],
    processedAt: doc.processedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function toPersistence(input: CreateKnowledgeInput) {
  return {
    noteId: input.noteId,
    stage: input.stage,
    core: input.core,
    ontologyMatches: input.ontologyMatches,
    graph: input.graph,
    prologFacts: input.prologFacts,
    gaps: input.gaps,
    confidenceBreakdown: input.confidenceBreakdown,
    confidence: input.confidence,
    aiFallback: input.aiFallback,
    processedAt: input.processedAt,
  };
}

export async function save(input: CreateKnowledgeInput): Promise<KnowledgeEntity> {
  const doc = await Knowledge.create(toPersistence(input));
  return toEntity(doc);
}

export async function upsert(input: CreateKnowledgeInput): Promise<KnowledgeEntity> {
  const doc = await Knowledge.findOneAndUpdate(
    { noteId: input.noteId },
    { $set: toPersistence(input), $unset: { error: "" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return toEntity(doc);
}

export async function upsertFailed(
  noteId: string,
  stage: PipelineStage,
  error: string,
): Promise<KnowledgeEntity> {
  const doc = await Knowledge.findOneAndUpdate(
    { noteId },
    {
      $set: { stage, error },
      $unset: {
        core: "",
        ontologyMatches: "",
        graph: "",
        prologFacts: "",
        gaps: "",
        confidenceBreakdown: "",
        confidence: "",
        aiFallback: "",
        processedAt: "",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return toEntity(doc);
}

export async function findByNoteId(noteId: string): Promise<KnowledgeEntity | null> {
  const doc = await Knowledge.findOne({ noteId });
  return doc ? toEntity(doc) : null;
}

export async function findStagesByNoteIds(
  noteIds: string[],
): Promise<Map<string, string>> {
  if (noteIds.length === 0) return new Map();
  const docs = await Knowledge.find(
    { noteId: { $in: noteIds } },
    { noteId: 1, stage: 1 },
  ).lean().exec();
  return new Map(docs.map((doc: { noteId: string; stage: string }) => [
    String(doc.noteId),
    doc.stage,
  ]));
}

export async function deleteByNoteId(noteId: string): Promise<boolean> {
  const result = await Knowledge.deleteOne({ noteId });
  return result.deletedCount === 1;
}

export async function exists(noteId: string): Promise<boolean> {
  return (await Knowledge.exists({ noteId })) !== null;
}

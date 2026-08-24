import { PaperIntelligence } from "@/server/models/Intelligence";
import { IntelligenceResultEntity } from "@/server/entities/intelligence.entity";
import { logger } from "@/server/utils/logger";
import { NotFoundError } from "@/server/utils/errors";
import * as groundedKnowledgeRepo from "@/server/repositories/grounded-knowledge.repo";
import type { GroundedKnowledge } from "@/server/intelligence/grounding";

function toEntity(
  doc: any,
  grounding: GroundedKnowledge | null,
): IntelligenceResultEntity {
  return IntelligenceResultEntity.fromPersistence({
    noteId: doc.noteId,
    stage: doc.stage,
    core: doc.core ?? null,
    grounding,
    ontology: doc.ontology ?? [],
    graph: doc.graph ?? null,
    facts: doc.facts ?? [],
    confidence: doc.confidence ?? null,
    failedStage: doc.failedStage ?? null,
    failedReason: doc.failedReason ?? null,
    processedAt: doc.processedAt,
    gaps: doc.gaps ?? null,
  });
}

export async function upsert(entity: IntelligenceResultEntity): Promise<void> {
  const data = entity.toPersistence();

  await PaperIntelligence.findOneAndUpdate(
    { noteId: data.noteId },
    {
      noteId: data.noteId,
      stage: data.stage,
      core: data.core,
      ontology: data.ontology,
      graph: data.graph,
      facts: data.facts,
      confidence: data.confidence,
      failedStage: null,
      failedReason: null,
      processedAt: data.processedAt,
      gaps: data.gaps,
    },
    { upsert: true, returnDocument: "after" }
  );

  logger.info("Intelligence result persisted", { noteId: data.noteId, stage: data.stage });
}

export async function upsertFailed(entity: IntelligenceResultEntity): Promise<void> {
  const data = entity.toPersistence();

  await PaperIntelligence.findOneAndUpdate(
    { noteId: data.noteId },
    {
      noteId: data.noteId,
      stage: data.stage,
      core: null,
      ontology: [],
      graph: null,
      facts: [],
      confidence: null,
      failedStage: data.failedStage,
      failedReason: data.failedReason,
      processedAt: data.processedAt,
      gaps: null,
    },
    { upsert: true, returnDocument: "after" }
  );

  logger.warn("Intelligence result marked failed", {
    noteId: data.noteId,
    failedStage: data.failedStage,
    reason: data.failedReason,
  });
}

export async function findByNoteId(noteId: string): Promise<IntelligenceResultEntity | null> {
  const [doc, grounding] = await Promise.all([
    PaperIntelligence.findOne({ noteId }).lean().exec(),
    groundedKnowledgeRepo.findByNoteId(noteId),
  ]);
  if (!doc) return null;
  return toEntity(doc, grounding);
}

export async function findByNoteIdOrThrow(noteId: string): Promise<IntelligenceResultEntity> {
  const result = await findByNoteId(noteId);
  if (!result) throw new NotFoundError("Intelligence result");
  return result;
}

export async function findStagesByNoteIds(
  noteIds: string[],
): Promise<Map<string, string>> {
  if (noteIds.length === 0) return new Map();

  const docs = await PaperIntelligence.find(
    { noteId: { $in: noteIds } },
    { noteId: 1, stage: 1 },
  ).lean().exec();

  return new Map(
    docs.map((doc: { noteId: string; stage: string }) => [
      String(doc.noteId),
      doc.stage,
    ]),
  );
}

export async function deleteByNoteId(noteId: string): Promise<void> {
  await Promise.all([
    PaperIntelligence.deleteOne({ noteId }),
    groundedKnowledgeRepo.deleteByNoteId(noteId),
  ]);
  logger.info("Intelligence result deleted", { noteId });
}

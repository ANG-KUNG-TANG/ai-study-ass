import * as intelligenceRepo from "@/server/repositories/intelligence.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { runPipeline, PipelineError } from "@/server/intelligence/engine";
import { IntelligenceResultEntity } from "@/server/entities/intelligence.entity";
import type {
  IntelligenceStage,
  ConfidenceMode,
} from "@/server/entities/intelligence.entity";
import type { RawDocument } from "@/server/intelligence/pipeline";
import { logger } from "@/server/utils/logger";

export function toRawDocument(input: {
  content: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount?: number;
}): RawDocument {
  return {
    rawText: input.content,
    fileName: input.fileName,
    mimeType:
      input.fileType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: input.fileSize,
    pageCount: input.pageCount,
  };
}

export async function runAndPersistPipeline(
  noteId: string,
  document: RawDocument
): Promise<IntelligenceResultEntity | null> {
  try {
    const result = await runPipeline({ noteId, document });

    const stillExists = await noteRepo.findById(noteId);
    if (!stillExists) {
      logger.warn("Note deleted during intelligence processing — discarding result", { noteId });
      return null;
    }

    const entity = IntelligenceResultEntity.createSuccess({
      noteId: result.noteId,
      stage: result.stage as IntelligenceStage,
      core: result.core ,
      ontology: result.ontology,
      graph: result.graph,
      facts: result.prolog.facts,
      confidence: result.confidence,
      processedAt: result.processedAt,
    });

    await intelligenceRepo.upsert(entity);
    logger.info("Intelligence result saved", { noteId });
    return entity;
  } catch (err) {
    const stage: IntelligenceStage =
      err instanceof PipelineError
        ? (err.stage as unknown as IntelligenceStage)
        : ("extraction" as IntelligenceStage);

    logger.error("Intelligence pipeline failed", {
      noteId,
      stage,
      error: err instanceof Error ? err.message : String(err),
    });

    const stillExists = await noteRepo.findById(noteId);
    if (!stillExists) {
      logger.warn("Note deleted during intelligence processing — discarding failure marker", { noteId });
      return null;
    }

    const failedEntity = IntelligenceResultEntity.createFailed(
      noteId,
      stage,
      err instanceof Error ? err.message : String(err)
    );
    await intelligenceRepo.upsertFailed(failedEntity);
    return failedEntity;
  }
}

export function processInBackground(noteId: string, document: RawDocument): void {
  void runAndPersistPipeline(noteId, document);
}

// ─── Read path ────────────────────────────────────────────────────────────
// Now self-contained: takes only noteId, fetches the note itself. Quiz/
// Flashcard/Chat services just call intelligenceService.getOrRunPipeline(
// noteId) — no RawDocument-building duplicated across three call sites.

export async function getOrRunPipeline(noteId: string): Promise<IntelligenceResultEntity> {
  const existing = await intelligenceRepo.findByNoteId(noteId);
  if (existing && existing.isComplete()) {
    return existing;
  }

  const note = await noteRepo.findByIdOrThrow(noteId);

  const document = toRawDocument({
    content: note.content,
    fileName: note.fileName,
    fileType: note.fileType,
    fileSize: note.fileSize,
  });

  const result = await runAndPersistPipeline(noteId, document);

  if (!result) {
    // Only reachable if the note was deleted in the brief window between
    // findByIdOrThrow above and runAndPersistPipeline's own re-check.
    throw await noteRepo.findByIdOrThrow(noteId).then(
      () => new Error("Unreachable"),
      (err) => err
    );
  }

  return result;
}

export async function getStatus(noteId: string): Promise<{
  exists: boolean;
  stage: IntelligenceStage | null;
  isComplete: boolean;
  hasFailed: boolean;
  confidence: number | null;
  mode: ConfidenceMode | null;
}> {
  const result = await intelligenceRepo.findByNoteId(noteId);

  if (!result) {
    return { exists: false, stage: null, isComplete: false, hasFailed: false, confidence: null, mode: null };
  }

  return {
    exists: true,
    stage: result.stage,
    isComplete: result.isComplete(),
    hasFailed: result.hasFailed(),
    confidence: result.confidence,
    mode: result.getConfidenceMode(),
  };
}

export async function getResultOrThrow(noteId: string): Promise<IntelligenceResultEntity> {
  return intelligenceRepo.findByNoteIdOrThrow(noteId);
}

export async function deleteForNote(noteId: string): Promise<void> {
  await intelligenceRepo.deleteByNoteId(noteId);
}
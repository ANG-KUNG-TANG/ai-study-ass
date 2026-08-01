import * as intelligenceRepo from "@/server/repositories/intelligence.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { runPipeline, PipelineError } from "@/server/intelligence/engine";
import { IntelligenceResultEntity } from "@/server/entities/intelligence.entity";
import type {
  IntelligenceStage,
  ConfidenceMode,
} from "@/server/entities/intelligence.entity";
import type { RawDocument } from "@/server/intelligence/pipeline";
import { generateForIntelligence } from "@/server/services/ai.service";
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

async function executePipelineWithFallback(
  noteId: string,
  document: RawDocument,
) {
  try {
    return await runPipeline({
      noteId,
      document,
      aiGenerate: generateForIntelligence,
    });
  } catch (firstError) {
    logger.warn(
      "Intelligence pipeline with AI fallback failed; retrying symbolic-only",
      {
        noteId,
        error:
          firstError instanceof Error
            ? firstError.message
            : String(firstError),
      },
    );

    return runPipeline({
      noteId,
      document,
    });
  }
}

export async function runAndPersistPipeline(
  noteId: string,
  document: RawDocument,
): Promise<IntelligenceResultEntity | null> {
  try {
    const result = await executePipelineWithFallback(noteId, document);
    const stillExists = await noteRepo.findById(noteId);

    if (!stillExists) {
      logger.warn(
        "Note deleted during intelligence processing; discarding result",
        { noteId },
      );
      return null;
    }

    const entity = IntelligenceResultEntity.createSuccess({
      noteId: result.noteId,
      stage: result.stage as IntelligenceStage,
      core: result.core,
      ontology: result.ontology,
      graph: result.graph,
      facts: result.prolog.facts,
      confidence: result.confidence,
      processedAt: result.processedAt,
      gaps: result.gaps,
    });

    await intelligenceRepo.upsert(entity);

    logger.info("Intelligence result saved", {
      noteId,
      confidence: result.confidence,
      mode: entity.getConfidenceMode(),
    });

    return entity;
  } catch (error) {
    const stage: IntelligenceStage =
      error instanceof PipelineError
        ? (error.stage as unknown as IntelligenceStage)
        : ("extraction" as IntelligenceStage);

    logger.error("Symbolic intelligence processing failed", {
      noteId,
      stage,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    const stillExists = await noteRepo.findById(noteId);
    if (!stillExists) return null;

    const failedEntity = IntelligenceResultEntity.createFailed(
      noteId,
      stage,
      error instanceof Error ? error.message : String(error),
    );

    await intelligenceRepo.upsertFailed(failedEntity);
    return failedEntity;
  }
}

export async function processInBackground(
  noteId: string,
  document: RawDocument,
): Promise<void> {
  await runAndPersistPipeline(noteId, document);
}

export async function getOrRunPipeline(
  noteId: string,
): Promise<IntelligenceResultEntity> {
  const existing = await intelligenceRepo.findByNoteId(noteId);

  // Reuse either a complete or failed persisted result. Feature services must
  // not independently rerun the pipeline after the orchestrator has already
  // processed this note. Explicit regeneration calls runAndPersistPipeline()
  // before invoking the feature services and replaces the persisted result.
  if (existing) {
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
    throw new Error(`Intelligence result was not created for note ${noteId}`);
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
    return {
      exists: false,
      stage: null,
      isComplete: false,
      hasFailed: false,
      confidence: null,
      mode: null,
    };
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

export async function getResultOrThrow(
  noteId: string,
): Promise<IntelligenceResultEntity> {
  return intelligenceRepo.findByNoteIdOrThrow(noteId);
}

export async function deleteForNote(noteId: string): Promise<void> {
  await intelligenceRepo.deleteByNoteId(noteId);
}

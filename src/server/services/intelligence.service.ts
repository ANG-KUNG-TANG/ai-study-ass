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
import * as progressService from "@/server/services/intelligence-progress.service";
import type { IntelligenceProgressSnapshot } from "@/server/services/intelligence-progress.service";
import { logger } from "@/server/utils/logger";
import { isIntelligenceV2Enabled } from "@/server/config/intelligence-v2.config";
import { GROUNDING_PIPELINE_VERSION } from "@/server/intelligence/grounding";

export function toRawDocument(input: {
  content: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount?: number;
  pages?: Array<{ pageNumber: number; rawText: string }>;
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
    pages: input.pages,
  };
}

export interface RunAndPersistPipelineOptions {
  /**
   * Background document preparation must remain provider-free.
   * Feature services may still opt into AI through their own repair paths.
   */
  allowAIRepair?: boolean;
}

export async function runAndPersistPipeline(
  noteId: string,
  document: RawDocument,
  options: RunAndPersistPipelineOptions = {},
): Promise<IntelligenceResultEntity | null> {
  const noteForUsage = await noteRepo.findById(noteId);
  progressService.begin(noteId);

  try {
    const runAttempt = (withAI: boolean) =>
      runPipeline({
        noteId,
        document,
        ...(withAI
          ? {
              aiGenerate: (prompt: string) =>
                generateForIntelligence(prompt, {
                  userId: noteForUsage?.userId,
                  noteId,
                }),
            }
          : {}),
        onProgress: (event) => {
          progressService.record(noteId, event);
        },
      });

    let result;
    const allowAIRepair = options.allowAIRepair ?? true;

    if (!allowAIRepair) {
      logger.info(
        "Running provider-free deterministic intelligence preparation",
        { noteId },
      );
      result = await runAttempt(false);
    } else {
      try {
        result = await runAttempt(true);
      } catch (aiEnabledError: unknown) {
        logger.warn(
          "AI-enabled intelligence run failed; retrying symbolically",
          {
            noteId,
            error:
              aiEnabledError instanceof Error
                ? aiEnabledError.message
                : String(aiEnabledError),
          },
        );

        progressService.begin(noteId);
        result = await runAttempt(false);
      }
    }

    const stillExists = await noteRepo.findById(noteId);
    if (!stillExists) {
      logger.warn("Note deleted during intelligence processing; discarding result", { noteId });
      progressService.fail(noteId, "The note was deleted while it was being analysed.");
      return null;
    }

    const entity = IntelligenceResultEntity.createSuccess({
      noteId: result.noteId,
      stage: result.stage as IntelligenceStage,
      core: result.core,
      grounding: result.grounding,
      ontology: result.ontology,
      graph: result.graph,
      facts: result.prolog.facts,
      confidence: result.confidence,
      processedAt: result.processedAt,
      gaps: result.gaps,
    });

    await intelligenceRepo.upsert(entity);
    progressService.complete(noteId);

    logger.info("Evidence-grounded intelligence result saved", {
      noteId,
      confidence: result.confidence,
      mode: entity.getConfidenceMode(),
      validatedClaims: result.core.validation?.validClaimIds?.length ?? 0,
      rejectedClaims: result.core.validation?.rejectedClaimIds?.length ?? 0,
      aiRepairUsed: result.aiFallback?.used ?? false,
    });

    return entity;
  } catch (error) {
    const stage: IntelligenceStage =
      error instanceof PipelineError
        ? (error.stage as unknown as IntelligenceStage)
        : ("extraction" as IntelligenceStage);
    const message = error instanceof Error ? error.message : String(error);

    progressService.fail(noteId, message);
    logger.error("Intelligence processing failed", { noteId, stage, error: message });

    const stillExists = await noteRepo.findById(noteId);
    if (!stillExists) return null;

    const failedEntity = IntelligenceResultEntity.createFailed(noteId, stage, message);
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
  if (
    existing?.isComplete() &&
    (
      !isIntelligenceV2Enabled() ||
      existing.grounding?.pipelineVersion === GROUNDING_PIPELINE_VERSION
    )
  ) {
    return existing;
  }

  const note = await noteRepo.findByIdOrThrow(noteId);
  const document = toRawDocument({
    content: note.content,
    fileName: note.fileName,
    fileType: note.fileType,
    fileSize: note.fileSize,
    pageCount: note.sourcePageCount,
    pages: note.sourcePages,
  });

  const result = await runAndPersistPipeline(noteId, document);
  if (!result) throw new Error(`Intelligence result was not created for note ${noteId}`);
  return result;
}

export async function getStatus(noteId: string): Promise<{
  exists: boolean;
  stage: IntelligenceStage | null;
  isComplete: boolean;
  hasFailed: boolean;
  confidence: number | null;
  mode: ConfidenceMode | null;
  progress: IntelligenceProgressSnapshot | null;
}> {
  const [result, progress] = await Promise.all([
    intelligenceRepo.findByNoteId(noteId),
    Promise.resolve(progressService.get(noteId)),
  ]);

  if (!result) {
    return {
      exists: false,
      stage: null,
      isComplete: progress?.state === "complete",
      hasFailed: progress?.state === "failed",
      confidence: null,
      mode: null,
      progress,
    };
  }

  return {
    exists: true,
    stage: result.stage,
    isComplete: result.isComplete(),
    hasFailed: result.hasFailed(),
    confidence: result.confidence,
    mode: result.getConfidenceMode(),
    progress,
  };
}

export async function getResultOrThrow(noteId: string): Promise<IntelligenceResultEntity> {
  return intelligenceRepo.findByNoteIdOrThrow(noteId);
}

export async function deleteForNote(noteId: string): Promise<void> {
  progressService.clear(noteId);
  await intelligenceRepo.deleteByNoteId(noteId);
}

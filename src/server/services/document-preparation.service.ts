import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import { NotFoundError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { StudyGenerationState } from "@/server/types/generation";

export interface PrepareDocumentInput {
  noteId: string;
  userId: string;
  force?: boolean;
}

function intelligenceHasFailed(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;

  const record = value as Record<string, unknown>;
  const hasFailed = record.hasFailed;

  if (typeof hasFailed === "function") {
    return Boolean((hasFailed as () => boolean).call(value));
  }

  if (record.failedStage) return true;
  if (typeof record.stage === "string") {
    return record.stage !== "complete";
  }

  return false;
}

/**
 * Eager work after upload is intentionally provider-free:
 * extraction -> deterministic intelligence -> persisted GroundedKnowledge.
 *
 * Summary, quiz, flashcards and chat generation remain pending until the
 * learner actually opens/requests those features.
 */
export async function prepareDocumentForStudy(
  input: PrepareDocumentInput,
): Promise<StudyGenerationState> {
  const note = await noteRepo.findByIdAndUserId(
    input.noteId,
    input.userId,
  );

  if (!note) {
    throw new NotFoundError("Note");
  }

  await generationRepo.initialise(
    input.noteId,
    input.userId,
    Boolean(input.force),
  );

  await generationRepo.updateStage(
    input.noteId,
    "analyzing",
  );

  const document = intelligenceService.toRawDocument({
    content: note.content,
    fileName: note.fileName,
    fileType: note.fileType,
    fileSize: note.fileSize,
    pageCount: note.sourcePageCount,
    pages: note.sourcePages,
  });

  const intelligence =
    await intelligenceService.runAndPersistPipeline(
      input.noteId,
      document,
      { allowAIRepair: false },
    );

  if (intelligenceHasFailed(intelligence)) {
    await generationRepo.updateStage(
      input.noteId,
      "failed",
    );

    throw new Error(
      "Document preparation stopped because deterministic intelligence did not complete successfully.",
    );
  }

  // `complete` now means background document preparation is complete.
  // Individual feature states intentionally remain `pending` until requested.
  await generationRepo.updateStage(
    input.noteId,
    "complete",
  );

  const state =
    await generationRepo.findByNoteId(
      input.noteId,
    );

  if (!state) {
    throw new Error(
      `Document preparation status was not found for note ${input.noteId}`,
    );
  }

  logger.info(
    "Document prepared for lazy study generation",
    {
      noteId: input.noteId,
      userId: input.userId,
      stage: state.stage,
      featureStatuses:
        Object.fromEntries(
          Object.entries(state.features).map(
            ([name, value]) => [
              name,
              value.status,
            ],
          ),
        ),
    },
  );

  return state;
}

import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as summaryService from "@/server/services/summary/summary.service";
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

function safeMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : String(error).slice(0, 500);
}

async function generateAutomaticSummary(
  input: PrepareDocumentInput,
): Promise<void> {
  await generationRepo.updateFeature(
    input.noteId,
    "summary",
    {
      status: "generating",
      error: null,
    },
  );

  try {
    const summary =
      await summaryService.generateSummary(
        input.noteId,
        {
          force: input.force,
          mode: "comprehensive",
        },
      );

    await generationRepo.updateFeature(
      input.noteId,
      "summary",
      {
        status: summary.status,
        source: summary.source,
        confidence:
          summary.confidence,
        aiFallbackUsed:
          summary.aiFallbackUsed,
        itemCount:
          summary.itemCount ?? 1,
        error: null,
      },
    );

    logger.info(
      "Automatic comprehensive Summary generated after document preparation",
      {
        noteId: input.noteId,
        userId: input.userId,
        source: summary.source,
        aiFallbackUsed:
          summary.aiFallbackUsed,
        tokensUsed:
          summary.tokensUsed ?? 0,
      },
    );
  } catch (error) {
    await generationRepo.updateFeature(
      input.noteId,
      "summary",
      {
        status: "failed",
        error:
          safeMessage(error),
      },
    );

    logger.warn(
      "Automatic Summary generation failed; document remains available for retry",
      {
        noteId: input.noteId,
        userId: input.userId,
        error:
          safeMessage(error),
      },
    );
  }
}

/**
 * Eager work after upload stays cheap:
 * extraction -> deterministic intelligence -> persisted GroundedKnowledge.
 *
 * A comprehensive Summary is then generated automatically. Summary may trigger
 * targeted Intelligence repair or one bounded learner-quality refinement when
 * needed. Quiz, flashcards and chat remain pending until requested.
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

  await generateAutomaticSummary(
    input,
  );

  // `complete` means document preparation plus the automatic Summary attempt
  // has finished. Quiz, flashcards and chat intentionally remain on demand.
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
    "Document prepared and automatic Summary generation finished",
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

import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as summaryService from "@/server/services/summary/summary.service";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import { ForbiddenError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { DEFAULT_FLASHCARDS } from "@/server/utils/constants";
import type { RawDocument } from "@/server/intelligence/pipeline";
import type {
  GenerationFeature,
  GenerationMetadata,
  StudyGenerationState,
} from "@/server/types/generation";

export interface GenerateStudyMaterialsInput {
  noteId: string;
  userId: string;
  document?: RawDocument;
  force?: boolean;
}

export interface BackgroundGenerationHooks {
  onComplete?: (
    state: StudyGenerationState,
  ) => void | Promise<void>;

  onError?: (
    error: unknown,
  ) => void | Promise<void>;
}

function safeMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : String(error).slice(0, 500);
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

  // Test doubles and compatibility adapters may omit entity methods. Their
  // presence still means the intelligence stage returned a usable value.
  return false;
}

async function runFeature<T>(
  noteId: string,
  feature: GenerationFeature,
  task: () => Promise<{
    value: T;
    metadata: GenerationMetadata;
  }>,
): Promise<T | null> {
  await generationRepo.updateFeature(noteId, feature, {
    status: "generating",
    error: null,
  });

  try {
    const result = await task();

    await generationRepo.updateFeature(noteId, feature, {
      status: result.metadata.status,
      source: result.metadata.source,
      confidence: result.metadata.confidence,
      aiFallbackUsed: result.metadata.aiFallbackUsed,
      itemCount: result.metadata.itemCount ?? null,
      error: null,
    });

    return result.value;
  } catch (error) {
    await generationRepo.updateFeature(noteId, feature, {
      status: "failed",
      error: safeMessage(error),
    });

    logger.error("Automatic study feature generation failed", {
      noteId,
      feature,
      error: safeMessage(error),
    });

    return null;
  }
}

function calculateFinalStage(
  state: StudyGenerationState,
): StudyGenerationState["stage"] {
  const statuses = Object.values(state.features).map(
    (feature) => feature.status,
  );

  if (statuses.every((status) => status === "ready")) {
    return "complete";
  }

  if (
    statuses.some(
      (status) => status === "ready" || status === "partial",
    )
  ) {
    return "partial";
  }

  return "failed";
}

export async function generateStudyMaterials(
  input: GenerateStudyMaterialsInput,
): Promise<StudyGenerationState> {
  const note = await noteRepo.findByIdOrThrow(input.noteId);

  if (!note.belongsTo(input.userId)) {
    throw new ForbiddenError();
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

  const document =
    input.document ??
    intelligenceService.toRawDocument({
      content: note.content,
      fileName: note.fileName,
      fileType: note.fileType,
      fileSize: note.fileSize,
    });

  const intelligence =
    await intelligenceService.runAndPersistPipeline(
      input.noteId,
      document,
    );

  if (intelligenceHasFailed(intelligence)) {
    await generationRepo.updateStage(
      input.noteId,
      "failed",
    );

    throw new Error(
      "Study-material generation stopped because document intelligence did not complete successfully.",
    );
  }

  await generationRepo.updateStage(
    input.noteId,
    "generating",
  );

  await Promise.allSettled([
    runFeature(input.noteId, "summary", async () => {
      const result = await summaryService.generateSummary(
        input.noteId,
        { force: input.force },
      );

      return {
        value: result,
        metadata: result,
      };
    }),

    runFeature(input.noteId, "quiz", async () => {
      const result =
        await quizService.generateQuizWithMetadata(
          input.noteId,
          input.userId,
          {
            force: input.force,
            dropInvalidQuestions: true,
          },
        );

      return {
        value: result.quiz,
        metadata: result.metadata,
      };
    }),

    runFeature(input.noteId, "flashcards", async () => {
      const result =
        await flashcardService.generateFlashcardsWithMetadata(
          input.noteId,
          input.userId,
          DEFAULT_FLASHCARDS,
          { force: input.force },
        );

      return {
        value: result.flashcards,
        metadata: result.metadata,
      };
    }),

    runFeature(input.noteId, "chatKnowledge", async () => {
      const metadata =
        await chatService.prepareChatKnowledge(
          input.noteId,
          input.userId,
        );

      return {
        value: metadata,
        metadata,
      };
    }),
  ]);

  const current =
    await generationRepo.findByNoteId(input.noteId);

  if (!current) {
    throw new Error(
      `Generation status disappeared for note ${input.noteId}`,
    );
  }

  await generationRepo.updateStage(
    input.noteId,
    calculateFinalStage(current),
  );

  const finalState =
    await generationRepo.findByNoteId(input.noteId);

  if (!finalState) {
    throw new Error(
      `Final generation status was not found for note ${input.noteId}`,
    );
  }

  logger.info("Automatic study material generation completed", {
    noteId: input.noteId,
    userId: input.userId,
    stage: finalState.stage,
    features: Object.fromEntries(
      Object.entries(finalState.features).map(
        ([name, value]) => [name, value.status],
      ),
    ),
  });

  return finalState;
}

async function runCompletionHook(
  input: GenerateStudyMaterialsInput,
  hook: BackgroundGenerationHooks["onComplete"],
  state: StudyGenerationState,
): Promise<void> {
  if (!hook) {
    return;
  }

  try {
    await hook(state);
  } catch (error) {
    logger.error(
      "Background generation completion hook failed",
      {
        noteId: input.noteId,
        userId: input.userId,
        error: safeMessage(error),
      },
    );
  }
}

async function runErrorHook(
  input: GenerateStudyMaterialsInput,
  hook: BackgroundGenerationHooks["onError"],
  error: unknown,
): Promise<void> {
  if (!hook) {
    return;
  }

  try {
    await hook(error);
  } catch (hookError) {
    logger.error(
      "Background generation error hook failed",
      {
        noteId: input.noteId,
        userId: input.userId,
        error: safeMessage(hookError),
      },
    );
  }
}

export function generateStudyMaterialsInBackground(
  input: GenerateStudyMaterialsInput,
  hooks: BackgroundGenerationHooks = {},
): void {
  void generateStudyMaterials(input)
    .then(async (state) => {
      await runCompletionHook(
        input,
        hooks.onComplete,
        state,
      );
    })
    .catch(async (error: unknown) => {
      logger.error(
        "Background study material generation failed",
        {
          noteId: input.noteId,
          userId: input.userId,
          error: safeMessage(error),
        },
      );

      await runErrorHook(
        input,
        hooks.onError,
        error,
      );
    });
}

export async function getGenerationStatus(
  noteId: string,
  userId: string,
): Promise<StudyGenerationState> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

  return (
    (await generationRepo.findByNoteId(noteId)) ??
    generationRepo.initialise(noteId, userId)
  );
}

export async function deleteForNote(
  noteId: string,
): Promise<void> {
  await generationRepo.deleteByNoteId(noteId);
}

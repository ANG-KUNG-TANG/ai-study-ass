import { randomUUID } from "crypto";
import * as noteRepo from "@/server/repositories/note.repo";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as generationService from "@/server/services/study-material-generation.service";
import { enqueueStudyGeneration } from "@/server/queues/study-generation.queue";
import { NoteEntity } from "@/server/entities/note.entity";
import { NotFoundError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { buildPaginationMeta } from "@/server/utils/response";
import type { ProcessedFile } from "@/server/services/upload.service";
import type { NoteQueryOptions } from "@/server/repositories/note.repo";

export type PublicNote = ReturnType<NoteEntity["toPublic"]>;

export interface CreateNoteOptions {
  telegramChatId?: number;
}

async function requireOwnedNote(
  noteId: string,
  userId: string,
): Promise<NoteEntity> {
  const note = await noteRepo.findByIdAndUserId(
    noteId,
    userId,
  );

  if (!note) {
    // Missing and foreign notes intentionally look identical to callers.
    throw new NotFoundError("Note");
  }

  return note;
}

export async function createNote(
  userId: string,
  file: ProcessedFile,
  options: CreateNoteOptions = {},
): Promise<PublicNote> {
  const title = file.fileName
    .replace(/\.(pdf|docx)$/i, "")
    .replace(/_/g, " ")
    .trim();

  const entity = NoteEntity.create({
    id: randomUUID(),
    userId,
    title,
    fileName: file.fileName,
    fileType: file.fileType,
    fileSize: file.fileSize,
    content: file.content,
  });

  const saved = await noteRepo.create(entity);
  const publicNote = saved.toPublic();

  logger.info("Note created from upload", {
    noteId: saved.id,
    userId,
    fileType: file.fileType,
    charCount: file.charCount,
  });

  try {
    await enqueueStudyGeneration({
      noteId: saved.id,
      userId,
      telegramChatId: options.telegramChatId,
    });
  } catch (error) {
    logger.error("Failed to enqueue study generation", {
      noteId: saved.id,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    // The upload endpoint should not report success when no generation
    // job exists. Roll back the just-created note if enqueueing fails.
    try {
      await noteRepo.deleteById(saved.id);
    } catch (rollbackError) {
      logger.error("Failed to roll back note after queue error", {
        noteId: saved.id,
        userId,
        error:
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError),
      });
    }

    throw error;
  }

  return publicNote;
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<ReturnType<NoteEntity["toPublic"]>> {
  const note = await requireOwnedNote(
    noteId,
    userId,
  );

  return note.toPublic();
}

export async function listNotes(
  userId: string,
  options: NoteQueryOptions = {},
) {
  const result = await noteRepo.findManyByUser(userId, options);

  return {
    data: result.data.map((note) => note.toPublic()),
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  };
}

export async function deleteNote(
  noteId: string,
  userId: string,
): Promise<void> {
  await requireOwnedNote(
    noteId,
    userId,
  );

  await Promise.all([
    noteRepo.deleteById(noteId),
    quizService.deleteForNote(noteId),
    flashcardService.deleteForNote(noteId),
    chatService.deleteForNote(noteId),
    intelligenceService.deleteForNote(noteId),
    generationService.deleteForNote(noteId),
  ]);

  logger.info("Note and associated study data deleted", {
    noteId,
    userId,
  });
}

export async function updateNoteSummary(
  noteId: string,
  userId: string,
  summary: string,
): Promise<void> {
  const note = await requireOwnedNote(
    noteId,
    userId,
  );

  note.updateSummary(summary);
  await noteRepo.updateSummary(noteId, note.summary!);
}

export async function getNoteContent(
  noteId: string,
  userId: string,
): Promise<{
  content: string;
  title: string;
}> {
  const note = await requireOwnedNote(
    noteId,
    userId,
  );

  return {
    content: note.content,
    title: note.title,
  };
}

export async function getGeneratedNotes(
  noteId: string,
  userId: string,
): Promise<{
  summary: string | null;
  title: string;
}> {
  const note = await requireOwnedNote(
    noteId,
    userId,
  );

  return {
    summary: note.summary,
    title: note.title,
  };
}

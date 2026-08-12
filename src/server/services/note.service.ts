import { randomUUID } from "crypto";
import * as noteRepo from "@/server/repositories/note.repo";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as generationService from "@/server/services/study-material-generation.service";
import * as recentNotesCache from "@/server/services/cache/recent-notes-cache.service";
import { enqueueStudyGeneration } from "@/server/queues/study-generation.queue";
import { NoteEntity } from "@/server/entities/note.entity";
import { ForbiddenError, ServiceUnavailableError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { buildPaginationMeta } from "@/server/utils/response";
import type { ProcessedFile } from "@/server/services/upload.service";
import type { NoteQueryOptions } from "@/server/repositories/note.repo";

export type PublicNote = ReturnType<NoteEntity["toPublic"]>;

export interface CreateNoteOptions {
  telegramChatId?: number;

  /**
   * Used when the document still needs
   * background OCR.
   *
   * The PDF ingestion worker will enqueue
   * study generation after OCR completes.
   */
  deferGeneration?: boolean;
}

function isDashboardRecentNotesQuery(options: NoteQueryOptions): boolean {
  return (
    (options.page ?? 1) === 1 &&
    (options.limit ?? 10) === 3 &&
    (options.sortBy ?? "createdAt") === "createdAt" &&
    (options.sortOrder ?? "desc") === "desc" &&
    !options.search?.trim() &&
    !options.fileType
  );
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

  await recentNotesCache.invalidateRecentNotesCache(userId);

  logger.info("Note created from upload", {
    noteId: saved.id,
    userId,
    fileType: file.fileType,
    charCount: file.charCount,
  });

  if (options.deferGeneration) {
    logger.info("Study generation deferred for note", {
      noteId: saved.id,
      userId,
    });
    
    return publicNote;
  }
  
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

    throw new ServiceUnavailableError(
      "Study generation is temporarily unavailable. Please try uploading the document again shortly.",
    );
  }

  return publicNote;
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<ReturnType<NoteEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

  return note.toPublic();
}

export async function listNotes(
  userId: string,
  options: NoteQueryOptions = {},
) {
  const cacheable = isDashboardRecentNotesQuery(options);

  if (cacheable) {
    const cached = await recentNotesCache.getRecentNotesCache(userId);

    if (cached) {
      return {
        data: cached.data,
        meta: buildPaginationMeta(cached.total, cached.page, cached.limit),
      };
    }
  }

  const result = await noteRepo.findManyByUser(userId, options);

  if (cacheable) {
    await recentNotesCache.setRecentNotesCache(userId, result);
  }

  return {
    data: result.data,
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  };
}

export async function deleteNote(
  noteId: string,
  userId: string,
): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

  await Promise.all([
    noteRepo.deleteById(noteId),
    quizService.deleteForNote(noteId),
    flashcardService.deleteForNote(noteId),
    chatService.deleteForNote(noteId),
    intelligenceService.deleteForNote(noteId),
    generationService.deleteForNote(noteId),
  ]);

  await recentNotesCache.invalidateRecentNotesCache(userId);

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
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

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
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

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
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

  return {
    summary: note.summary,
    title: note.title,
  };
}

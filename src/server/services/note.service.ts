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
  /** The PDF worker will enqueue provider-free preparation after extraction. */
  deferGeneration?: boolean;
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
    sourcePageCount: file.pageCount,
    sourcePages: file.pages,
  });

  const saved = await noteRepo.create(entity);
  const publicNote = saved.toPublic();

  logger.info("Note created from upload", {
    noteId: saved.id,
    userId,
    fileType: file.fileType,
    charCount: file.charCount,
  });

  if (options.deferGeneration) {
    logger.info("Study generation deferred for background ingestion", {
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
      mode: "prepare",
    });
  } catch (error) {
    // The document itself is valid and saved. Preparation is an optimization,
    // not a prerequisite: any feature can lazily run intelligence later.
    logger.warn(
      "Document saved but background preparation could not be queued",
      {
        noteId: saved.id,
        userId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
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

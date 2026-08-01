import { randomUUID } from "crypto";
import * as noteRepo from "@/server/repositories/note.repo";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as generationService from "@/server/services/study-material-generation.service";
import { NoteEntity } from "@/server/entities/note.entity";
import { ForbiddenError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { buildPaginationMeta } from "@/server/utils/response";
import type { ProcessedFile } from "@/server/services/upload.service";
import type { NoteQueryOptions } from "@/server/repositories/note.repo";

export async function createNote(
  userId: string,
  file: ProcessedFile,
): Promise<ReturnType<NoteEntity["toPublic"]>> {
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

  logger.info("Note created from upload", {
    noteId: saved.id,
    userId,
    fileType: file.fileType,
    charCount: file.charCount,
  });

  const document = intelligenceService.toRawDocument({
    content: file.content,
    fileName: file.fileName,
    fileType: file.fileType,
    fileSize: file.fileSize,
    pageCount: file.pageCount,
  });

  generationService.generateStudyMaterialsInBackground({
    noteId: saved.id,
    userId,
    document,
  });

  return saved.toPublic();
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
  const result = await noteRepo.findManyByUser(
    userId,
    options,
  );

  return {
    data: result.data.map((note) => note.toPublic()),
    meta: buildPaginationMeta(
      result.total,
      result.page,
      result.limit,
    ),
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
  await noteRepo.updateSummary(
    noteId,
    note.summary!,
  );
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

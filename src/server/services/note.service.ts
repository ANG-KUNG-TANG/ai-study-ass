import { randomUUID } from "crypto";
import * as noteRepo from "@/server/repositories/note.repo";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import * as intelligenceService from "@/server/services/intelligence.service";
import { generateStudyNotes } from "@/server/services/summary/study-note-generator.service";
import { aiGenerate } from "@/server/services/ai-generate.adapter";
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

  // `content` remains the original extracted PDF/DOCX text.
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

  const rawDocument = intelligenceService.toRawDocument({
    content: file.content,
    fileName: file.fileName,
    fileType: file.fileType,
    fileSize: file.fileSize,
    pageCount: file.pageCount,
  });

  // Intelligence analysis is useful for graph/quiz/chat features, but it should
  // not block the user from receiving generated study notes.
  const backgroundProcessing = intelligenceService.processInBackground(
    saved.id,
    rawDocument,
  ) as unknown;

  if (backgroundProcessing instanceof Promise) {
    backgroundProcessing.catch((err: unknown) => {
      logger.error("Background intelligence processing failed", {
        noteId: saved.id,
        userId,
        err,
      });
    });
  }

  try {
    // This is the missing step: AI rewrites the source into actual study notes.
    const generatedNotes = await generateStudyNotes(
      {
        title,
        sourceText: file.content,
      },
      aiGenerate,
    );

    const updated = await noteRepo.updateSummary(saved.id, generatedNotes);

    logger.info("Study notes generated from uploaded document", {
      noteId: saved.id,
      userId,
      sourceLength: file.content.length,
      notesLength: generatedNotes.length,
    });

    // Return the updated note, so the upload response already contains `summary`.
    return updated.toPublic();
  } catch (err) {
    logger.error("Study-note generation failed", {
      noteId: saved.id,
      userId,
      err,
    });

    // The original upload remains saved. The API still returns the note rather
    // than losing the document because the AI provider was temporarily unavailable.
    return saved.toPublic();
  }
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<ReturnType<NoteEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();
  return note.toPublic();
}

export async function listNotes(userId: string, options: NoteQueryOptions = {}) {
  const result = await noteRepo.findManyByUser(userId, options);
  const meta = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    data: result.data.map((note) => note.toPublic()),
    meta,
  };
}

export async function deleteNote(noteId: string, userId: string): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  await Promise.all([
    noteRepo.deleteById(noteId),
    quizService.deleteForNote(noteId),
    flashcardService.deleteForNote(noteId),
    chatService.deleteForNote(noteId),
    intelligenceService.deleteForNote(noteId),
  ]);

  logger.info("Note and all associated data deleted", {
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
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  note.updateSummary(summary);
  await noteRepo.updateSummary(noteId, note.summary!);
}

/** Original extracted document text, used as source context for chat/quiz services. */
export async function getNoteContent(
  noteId: string,
  userId: string,
): Promise<{ content: string; title: string }> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  return {
    content: note.content,
    title: note.title,
  };
}

/** Generated study notes for the note-reading page. */
export async function getGeneratedNotes(
  noteId: string,
  userId: string,
): Promise<{ summary: string | null; title: string }> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  return {
    summary: note.summary,
    title: note.title,
  };
}

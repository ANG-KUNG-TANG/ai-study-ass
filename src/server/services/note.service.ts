import { randomUUID } from "crypto";
import * as noteRepo from "@/server/repositories/note.repository";
import * as quizRepo from "@/server/repositories/quiz.repository";
import * as flashcardRepo from "@/server/repositories/flashcard.repository";
import * as chatRepo from "@/server/repositories/chat.repository";
import { NoteEntity } from "@/server/entities/note.entity";
import { ForbiddenError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { buildPaginationMeta } from "@/server/utils/response";
import type { ProcessedFile } from "@/server/services/upload.service";
import type { NoteQueryOptions } from "@/server/repositories/note.repository";

// ─── Create from upload ───────────────────────────────────────────────────────
// Called after processUpload() returns the extracted content.
// Title defaults to the file name without extension.

export async function createNote(
  userId: string,
  file: ProcessedFile
): Promise<ReturnType<NoteEntity["toPublic"]>> {
  const title = file.fileName.replace(/\.(pdf|docx)$/i, "").replace(/_/g, " ");

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

  return saved.toPublic();
}

// ─── Get single note ──────────────────────────────────────────────────────────

export async function getNoteById(
  noteId: string,
  userId: string
): Promise<ReturnType<NoteEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  // Use entity method for ownership check — not inline comparison
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  return note.toPublic();
}

// ─── List all notes for user ──────────────────────────────────────────────────

export async function listNotes(
  userId: string,
  options: NoteQueryOptions = {}
) {
  const result = await noteRepo.findManyByUser(userId, options);
  const meta = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    data: result.data.map((n) => n.toPublic()),
    meta,
  };
}

// ─── Delete note + cascade ────────────────────────────────────────────────────
// Deletes the note and all associated quiz, flashcard, and chat data.
// All cascade deletes run in parallel for speed.

export async function deleteNote(
  noteId: string,
  userId: string
): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) throw new ForbiddenError();

  // Cascade delete all associated data in parallel
  await Promise.all([
    noteRepo.deleteById(noteId),
    quizRepo.deleteByNoteId(noteId),
    flashcardRepo.deleteByNoteId(noteId),
    chatRepo.deleteByNoteId(noteId),
  ]);

  logger.info("Note and all associated data deleted", { noteId, userId });
}

// ─── Update summary ───────────────────────────────────────────────────────────
// Called by summary.service after AI generates the summary.

export async function updateNoteSummary(
  noteId: string,
  summary: string
): Promise<void> {
  await noteRepo.updateSummary(noteId, summary);
}

// ─── Get note content for AI ──────────────────────────────────────────────────
// Returns the raw content string for injection into AI prompts.
// Ownership check enforced before returning content.

export async function getNoteContent(
  noteId: string,
  userId: string
): Promise<{ content: string; title: string }> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) throw new ForbiddenError();

  return {
    content: note.content,
    title: note.title,
  };
}
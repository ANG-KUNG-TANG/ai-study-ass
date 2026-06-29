// import { randomUUID } from "crypto";
// import * as noteRepo from "@/server/repositories/note.repo";
// import * as quizRepo from "@/server/repositories/quiz.repo";
// import * as flashcardRepo from "@/server/repositories/flashcard.repo";
// import * as chatRepo from "@/server/repositories/chat.repo";
// import { upsertKnowledgeObject, deleteKnowledgeObjectByNoteId } from "@/server/repositories/knowledge_object.repo";
// import { NoteEntity } from "@/server/entities/note.entity";
// import { ForbiddenError } from "@/server/utils/errors";
// import { logger } from "@/server/utils/logger";
// import { buildPaginationMeta } from "@/server/utils/response";
// import { runPipeline } from "@/server/pipeline/index";
// import type { ProcessedFile } from "@/server/services/upload.service";
// import type { NoteQueryOptions } from "@/server/repositories/note.repo";

// // ─── Create from upload ───────────────────────────────────────────────────────
// // 1. Save the note
// // 2. Run the intelligence pipeline on the extracted text
// // 3. Persist the knowledge object (non-blocking — failure won't break upload)

// export async function createNote(
//   userId: string,
//   file: ProcessedFile
// ): Promise<ReturnType<NoteEntity["toPublic"]>> {
//   const title = file.fileName.replace(/\.(pdf|docx)$/i, "").replace(/_/g, " ");

//   const entity = NoteEntity.create({
//     id: randomUUID(),
//     userId,
//     title,
//     fileName: file.fileName,
//     fileType: file.fileType,
//     fileSize: file.fileSize,
//     content: file.content,
//   });

//   const saved = await noteRepo.create(entity);

//   logger.info("Note created from upload", {
//     noteId: saved.id,
//     userId,
//     fileType: file.fileType,
//     charCount: file.charCount,
//   });

//   // ── Pipeline ────────────────────────────────────────────────────────────────
//   // Run after save so a pipeline failure never blocks the upload response.
//   // The knowledge object is upserted so re-uploads on the same note are safe.
//   runPipeline({
//     rawText: file.content,
//     fileName: file.fileName,
//     mimeType: file.fileType === "pdf"
//       ? "application/pdf"
//       : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     fileSize: file.fileSize,
//     pageCount: file.pageCount,
//   })
//     .then(({ knowledge }) =>
//       upsertKnowledgeObject({ noteId: saved.id, core: knowledge })
//     )
//     .then(() => logger.info("Knowledge object saved", { noteId: saved.id }))
//     .catch((err) =>
//       logger.error("Pipeline failed — knowledge object not saved", {
//         noteId: saved.id,
//         error: err instanceof Error ? err.message : String(err),
//       })
//     );

//   return saved.toPublic();
// }

// // ─── Get single note ──────────────────────────────────────────────────────────

// export async function getNoteById(
//   noteId: string,
//   userId: string
// ): Promise<ReturnType<NoteEntity["toPublic"]>> {
//   const note = await noteRepo.findByIdOrThrow(noteId);

//   if (!note.belongsTo(userId)) throw new ForbiddenError();

//   return note.toPublic();
// }

// // ─── List all notes for user ──────────────────────────────────────────────────

// export async function listNotes(
//   userId: string,
//   options: NoteQueryOptions = {}
// ) {
//   const result = await noteRepo.findManyByUser(userId, options);
//   const meta = buildPaginationMeta(result.total, result.page, result.limit);

//   return {
//     data: result.data.map((n) => n.toPublic()),
//     meta,
//   };
// }

// // ─── Delete note + cascade ────────────────────────────────────────────────────
// // Deletes the note and ALL associated data including the knowledge object.

// export async function deleteNote(
//   noteId: string,
//   userId: string
// ): Promise<void> {
//   const note = await noteRepo.findByIdOrThrow(noteId);

//   if (!note.belongsTo(userId)) throw new ForbiddenError();

//   await Promise.all([
//     noteRepo.deleteById(noteId),
//     quizRepo.deleteByNoteId(noteId),
//     flashcardRepo.deleteByNoteId(noteId),
//     chatRepo.deleteByNoteId(noteId),
//     deleteKnowledgeObjectByNoteId(noteId),
//   ]);

//   logger.info("Note and all associated data deleted", { noteId, userId });
// }

// // ─── Update summary ───────────────────────────────────────────────────────────

// export async function updateNoteSummary(
//   noteId: string,
//   summary: string
// ): Promise<void> {
//   await noteRepo.updateSummary(noteId, summary);
// }

// // ─── Get note content for AI ──────────────────────────────────────────────────

// export async function getNoteContent(
//   noteId: string,
//   userId: string
// ): Promise<{ content: string; title: string }> {
//   const note = await noteRepo.findByIdOrThrow(noteId);

//   if (!note.belongsTo(userId)) throw new ForbiddenError();

//   return { content: note.content, title: note.title };
// }
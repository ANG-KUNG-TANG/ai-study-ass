// =============================================================================
// server/repositories/quiz.repository.ts
//
// Only this file touches the Mongoose Quiz model directly. Every function
// returns a QuizEntity (or null/array of them), never a raw Mongoose
// document — callers (quiz.service.ts) should never see an _id, a
// Mongoose Document method, or anything else that leaks the persistence
// layer's shape into business logic.
// =============================================================================

import { Quiz, type QuizDocument } from '../models/Quiz';
import { QuizEntity, type QuizQuestionInput } from '../entities/quiz.entity';

function toEntity(doc: QuizDocument): QuizEntity {
  return new QuizEntity({
    id: doc._id.toString(),
    noteId: doc.noteId.toString(),
    userId: doc.userId.toString(),
    questions: doc.questions as QuizQuestionInput[],
    createdAt: doc.createdAt,
  });
}

export async function create(params: {
  noteId: string;
  userId: string;
  questions: QuizQuestionInput[];
}): Promise<QuizEntity> {
  // Constructing the entity FIRST means QuizEntity's own validation rules
  // run before anything touches the database — an invalid quiz never
  // reaches Mongo, it throws QuizValidationError right here.
  const doc = await Quiz.create({
    noteId: params.noteId,
    userId: params.userId,
    questions: params.questions,
  });
  return toEntity(doc);
}

export async function findById(id: string): Promise<QuizEntity | null> {
  const doc = await Quiz.findById(id);
  return doc ? toEntity(doc) : null;
}

/**
 * All quizzes generated from a given note (for the given user), most
 * recent first. A note can have multiple quizzes — each generateQuiz()
 * call creates a new one rather than overwriting, so users can retake a
 * fresh quiz without losing their previous attempt's questions.
 */
export async function findAllByNote(noteId: string, userId: string): Promise<QuizEntity[]> {
  const docs = await Quiz.find({ noteId, userId }).sort({ createdAt: -1 });
  return docs.map(toEntity);
}

/** Most recent quiz for a note, or null if none exist yet. */
export async function findLatestByNote(noteId: string, userId: string): Promise<QuizEntity | null> {
  const doc = await Quiz.findOne({ noteId, userId }).sort({ createdAt: -1 });
  return doc ? toEntity(doc) : null;
}

export async function deleteById(id: string): Promise<boolean> {
  const result = await Quiz.findByIdAndDelete(id);
  return result !== null;
}

/** Used by note.service.ts's cascade delete when a Note is removed. */
export async function deleteByNoteId(noteId: string): Promise<number> {
  const result = await Quiz.deleteMany({ noteId });
  return result.deletedCount ?? 0;
}

/** All quizzes across all notes for a given user, most recent first. */
export async function findAllByUser(userId: string): Promise<QuizEntity[]> {
  const docs = await Quiz.find({ userId }).sort({ createdAt: -1 });
  return docs.map(toEntity);
}
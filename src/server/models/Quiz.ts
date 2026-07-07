// =============================================================================
// server/models/Quiz.ts
//
// Mongoose schema/model — persistence only. No business rules live here;
// those belong to QuizEntity (server/entities/quiz.entity.ts). This file's
// only job is mapping to/from MongoDB documents, per your DDD layering:
// "models import entity rule constants as the single source of truth."
//
// The documented Quiz collection design lists `questions: []` with no
// declared shape. Left untyped, that's an easy way to end up with
// inconsistent question documents over time, so it's expanded here into a
// concrete subdocument schema — question/questionType/options/answer/
// explanation — matching the richer Quiz Model block feature list
// (questionType enum, explanation field).
// =============================================================================

import { Schema, model, models, type Document, type Types } from 'mongoose';
import { QUESTION_TYPES, type QuestionType } from '../entities/quiz.entity';

export interface QuizQuestionDoc {
  question: string;
  questionType: QuestionType;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizDocument extends Document {
  _id: Types.ObjectId;
  noteId: Types.ObjectId;
  userId: Types.ObjectId;
  questions: QuizQuestionDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<QuizQuestionDoc>(
  {
    question: { type: String, required: true },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String], default: [] },
    answer: { type: String, required: true },
    explanation: { type: String },
  },
  { _id: false }, // questions are always accessed as part of the parent quiz, not individually
);

const QuizSchema = new Schema<QuizDocument>(
  {
    noteId: { type: Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questions: { type: [QuizQuestionSchema], required: true },
  },
  { timestamps: true },
);

// Compound index — matches the roadmap's "Index on noteId + userId" note,
// and is what quiz.repository.ts's findByNoteId() actually queries on.
QuizSchema.index({ noteId: 1, userId: 1 });

// Reuse the existing model if this module is re-imported (Next.js
// hot-reload safe) — same pattern your database connection module uses.
export const Quiz = models.Quiz ?? model<QuizDocument>('Quiz', QuizSchema);
export default Quiz;
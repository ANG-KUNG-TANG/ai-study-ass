import mongoose, { Schema, Document, Model } from "mongoose";
import { QUIZ_RULES, type QuestionType, type DifficultyLevel } from "@/server/entities/quiz.entity";

export interface IQuiz extends Document {
  noteId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  questions: {
    id: string;
    question: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    explanation: string | null;
  }[];
  difficulty: DifficultyLevel;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    type: {
      type: String,
      enum: ["multiple_choice", "true_false", "short_answer"] satisfies QuestionType[],
      required: true,
    },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, default: null },
  },
  { _id: false }  // subdoc — no separate _id needed
);

const quizSchema = new Schema<IQuiz>(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (v: unknown[]) =>
          v.length >= QUIZ_RULES.questions.min && v.length <= QUIZ_RULES.questions.max,
        message: `Quiz must have between ${QUIZ_RULES.questions.min} and ${QUIZ_RULES.questions.max} questions`,
      },
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"] satisfies DifficultyLevel[],
      required: true,
    },
  },
  { timestamps: true }
);

quizSchema.index({ noteId: 1, userId: 1 });

export const Quiz: Model<IQuiz> =
  mongoose.models.Quiz ?? mongoose.model<IQuiz>("Quiz", quizSchema);
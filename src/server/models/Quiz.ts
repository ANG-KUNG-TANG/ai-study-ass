import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from "mongoose";
import {
  QUESTION_TYPES,
  type QuestionType,
} from "@/server/entities/quiz.entity";

export interface QuizQuestionDocument {
  question: string;
  questionType: QuestionType;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizPersistence {
  noteId: string;
  userId: string;
  questions: QuizQuestionDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export type QuizDocument =
  HydratedDocument<QuizPersistence>;

const quizQuestionSchema =
  new Schema<QuizQuestionDocument>(
    {
      question: {
        type: String,
        required: true,
        trim: true,
      },

      questionType: {
        type: String,
        enum: QUESTION_TYPES,
        required: true,
      },

      options: {
        type: [String],
        default: [],
      },

      answer: {
        type: String,
        required: true,
        trim: true,
      },

      explanation: {
        type: String,
        required: false,
        trim: true,
      },
    },
    {
      _id: false,
    },
  );

const quizSchema =
  new Schema<QuizPersistence>(
    {
      noteId: {
        type: String,
        required: true,
        index: true,
      },

      userId: {
        type: String,
        required: true,
        index: true,
      },

      questions: {
        type: [quizQuestionSchema],
        required: true,
        validate: {
          validator: (
            value: QuizQuestionDocument[],
          ) => value.length > 0,
          message:
            "Quiz must contain at least one question",
        },
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

quizSchema.index({
  noteId: 1,
  userId: 1,
  createdAt: -1,
});

export const Quiz: Model<QuizPersistence> =
  (models.Quiz as
    | Model<QuizPersistence>
    | undefined) ??
  model<QuizPersistence>(
    "Quiz",
    quizSchema,
  );

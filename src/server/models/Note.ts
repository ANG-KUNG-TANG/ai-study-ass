import mongoose, { Schema, type Document, type Model } from "mongoose";
import { NOTE_RULES, type FileType } from "@/server/entities/note.entity";

export interface INote extends Document<string> {
  _id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  /** Original text extracted from the uploaded document. */
  content: string;
  /** Private page-preserving extraction data used for exact provenance. */
  sourcePageCount?: number;
  sourcePages?: Array<{
    pageNumber: number;
    rawText: string;
  }>;
  /** AI-generated, paraphrased study notes. */
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    _id: { type: String },
    userId: { type: String, required: true, index: true },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: NOTE_RULES.TITLE_MAX,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: NOTE_RULES.FILE_NAME_MAX,
    },
    fileType: {
      type: String,
      enum: ["pdf", "docx"] satisfies FileType[],
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    content: {
      type: String,
      required: true,
      maxlength: NOTE_RULES.CONTENT_MAX,
    },
    sourcePageCount: {
      type: Number,
      min: 1,
    },
    sourcePages: {
      type: [
        new Schema(
          {
            pageNumber: {
              type: Number,
              required: true,
              min: 1,
            },
            rawText: {
              type: String,
              required: true,
              maxlength: NOTE_RULES.CONTENT_MAX,
            },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    summary: {
      type: String,
      default: null,
      maxlength: NOTE_RULES.SUMMARY_MAX,
    },
  },
  { timestamps: true },
);

noteSchema.index({ userId: 1, createdAt: -1 });

export const Note: Model<INote> =
  mongoose.models.Note ?? mongoose.model<INote>("Note", noteSchema);

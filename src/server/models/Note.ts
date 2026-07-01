import mongoose, { Schema, Document, Model } from "mongoose";
import { NOTE_RULES, type FileType } from "@/server/entities/note.entity";

export interface INote extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  content: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: NOTE_RULES.TITLE_MAX,
    },
    fileName: { type: String, required: true, maxlength: NOTE_RULES.FILE_NAME_MAX },
    fileType: { type: String, enum: ["pdf", "docx"] satisfies FileType[], required: true },
    fileSize: { type: Number, required: true },
    content: { type: String, required: true, maxlength: NOTE_RULES.CONTENT_MAX },
    summary: { type: String, default: null, maxlength: NOTE_RULES.SUMMARY_MAX },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, createdAt: -1 });

export const Note: Model<INote> = mongoose.models.Note ?? mongoose.model<INote>("Note", noteSchema);
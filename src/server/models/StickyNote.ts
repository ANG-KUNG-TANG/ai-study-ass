import mongoose, { Schema, type Document, type Model } from "mongoose";
import { STICKY_NOTE_RULES } from "@/server/entities/sticky-note.entity";

export interface IStickyNote extends Document<string> {
  _id: string;
  userId: string;
  content: string;
  sourcePath: string;
  createdAt: Date;
  updatedAt: Date;
}

const stickyNoteSchema = new Schema<IStickyNote>(
  {
    _id: { type: String, required: true },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: STICKY_NOTE_RULES.CONTENT_MAX,
    },
    sourcePath: {
      type: String,
      default: "",
      trim: true,
      maxlength: STICKY_NOTE_RULES.SOURCE_PATH_MAX,
    },
  },
  { timestamps: true },
);

stickyNoteSchema.index({ userId: 1, createdAt: -1 });

export const StickyNote: Model<IStickyNote> =
  mongoose.models.StickyNote ??
  mongoose.model<IStickyNote>("StickyNote", stickyNoteSchema);

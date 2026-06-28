import mongoose, { Schema, Document, Model, mongo} from "mongoose";
import { NOTE_RULES, type FileType } from "../entities/note.entity";
import { maxLength, number } from "zod";

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
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true},
        title: { 
            type: String,
            required: true,
            trim: true,
            maxLength: NOTE_RULES.title.maxLength
        },
        fileName : { type: String, required: true, maxLength: NOTE_RULES.fileName.maxLength},
        fileType: { type:String, enum: ["pdf", "docx"] satisfies FileType[], required: true},
        fileSize: { type: Number, required: true},
        content: { type: String, required: true, maxLength: NOTE_RULES.context.maxLength},
        summary: { type: String, default: null},
    },
    { timestamps: true}
);

noteSchema.index({ userId: 1, createdAt: -1});

export const Note: Model<INote> = mongoose.models.Note ?? mongoose.model<INote>("Note", noteSchema);
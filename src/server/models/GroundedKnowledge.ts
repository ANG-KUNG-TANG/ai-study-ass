import mongoose from "mongoose";
import type { Document } from "mongoose";
import type { GroundedKnowledge } from "@/server/intelligence/grounding";

const { Schema } = mongoose;

export interface GroundedKnowledgeDoc extends Document {
  noteId: string;
  sourceHash: string;
  schemaVersion: string;
  pipelineVersion: string;
  data: GroundedKnowledge;
  createdAt: Date;
  updatedAt: Date;
}

const GroundedKnowledgeSchema = new Schema<GroundedKnowledgeDoc>(
  {
    noteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sourceHash: {
      type: String,
      required: true,
      index: true,
    },
    schemaVersion: {
      type: String,
      required: true,
    },
    pipelineVersion: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const GroundedKnowledgeModel =
  mongoose.models.GroundedKnowledge ??
  mongoose.model<GroundedKnowledgeDoc>(
    "GroundedKnowledge",
    GroundedKnowledgeSchema,
  );

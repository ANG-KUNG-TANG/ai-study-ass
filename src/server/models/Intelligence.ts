import mongoose from "mongoose";
import type { Document } from "mongoose";

const { Schema } = mongoose;

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Persists the storable subset of IntelligenceResult (engine.ts). We deliberately
// do NOT store `prolog.engine` (a live class instance — not serializable). We DO
// store the resolved `graph` and `facts` (plain serializable data, not the live
// tau-prolog engine) so hasReasoningData() and any future graph-traversal feature
// (e.g. chat.service.ts) can read them back after a DB round-trip.
// `core` and `ontology` are typed as Mixed here because their exact shape lives
// in server/intelligence/types.ts (KnowledgeCore / ResolvedConcept) — once that
// file is shared, tighten this schema to match field-for-field. Mixed is safe
// for now because Mongoose won't validate/strip fields it doesn't recognize.

export type IntelligenceStage =
  | "extraction"
  | "ontology"
  | "graph"
  | "prolog"
  | "complete";

export interface PaperIntelligenceDoc extends Document {
  noteId: string;
  stage: IntelligenceStage;
  core: Record<string, unknown> | null;
  ontology: Record<string, unknown>[];
  graph: Record<string, unknown> | null;
  facts: Record<string, unknown>[];
  confidence: number | null;
  failedStage: IntelligenceStage | null;
  failedReason: string | null;
  processedAt: Date;
  gaps?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaperIntelligenceSchema = new Schema<PaperIntelligenceDoc>(
  {
    noteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stage: {
      type: String,
      enum: [
        "extraction",
        "ontology",
        "graph",
        "prolog",
        "complete",
      ],
      required: true,
    },
    core: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ontology: {
      type: [Schema.Types.Mixed] as unknown as any,
      default: [],
    },
    graph: {
      type: Schema.Types.Mixed,
      default: null,
    },
    facts: {
      type: [Schema.Types.Mixed] as unknown as any,
      default: [],
    },
    confidence: {
      type: Number,
      default: null,
    },
    failedStage: {
      type: String,
      enum: [
        "extraction",
        "ontology",
        "graph",
        "prolog",
        "complete",
        null,
      ],
      default: null,
    },
    failedReason: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      required: true,
    },
    gaps: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent model overwrite errors on Next.js hot reload and worker restarts.
// Access model registry through the Mongoose default export so the same file
// works in both Next.js bundling and direct Node/tsx ESM execution.
export const PaperIntelligence =
  mongoose.models.PaperIntelligence ??
  mongoose.model<PaperIntelligenceDoc>(
    "PaperIntelligence",
    PaperIntelligenceSchema,
  );

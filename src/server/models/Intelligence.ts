import { Schema, model, models, type Document } from "mongoose";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Persists the storable subset of IntelligenceResult (engine.ts). We deliberately
// do NOT store `prolog.engine` (a live class instance — not serializable) or the
// full `graph` unless you decide chat.service.ts needs live graph traversal later.
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
  core: Record<string, unknown> | null;       // KnowledgeCore, once typed
  ontology: Record<string, unknown>[];         // ResolvedConcept[], once typed
  confidence: number | null;
  failedStage: IntelligenceStage | null;       // set only when stage !== 'complete'
  failedReason: string | null;
  processedAt: Date;
  gaps?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaperIntelligenceSchema = new Schema<PaperIntelligenceDoc>(
  {
    noteId: { type: String, required: true, unique: true, index: true },
    stage: {
      type: String,
      enum: ["extraction", "ontology", "graph", "prolog", "complete"],
      required: true,
    },
    core: { type: Schema.Types.Mixed, default: null },
    // Use a type-cast to satisfy Mongoose+TypeScript typing for arrays of Mixed
    ontology: { type: [Schema.Types.Mixed] as unknown as any, default: [] },
    confidence: { type: Number, default: null },
    failedStage: {
      type: String,
      enum: ["extraction", "ontology", "graph", "prolog", "complete", null],
      default: null,
    },
    failedReason: { type: String, default: null },
    processedAt: { type: Date, required: true },
    gaps: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Prevent model overwrite errors on Next.js hot-reload
export const PaperIntelligence =
  models.PaperIntelligence || model<PaperIntelligenceDoc>("PaperIntelligence", PaperIntelligenceSchema);
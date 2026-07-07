// server/models/Knowledge.ts
// Only the diff from last turn: stage/error added, core/graph/etc. now optional.

import { Schema, model, models, Types, Document } from 'mongoose';

export interface KnowledgeDocument extends Document {
  noteId: Types.ObjectId;
  stage: 'pending' | 'document' | 'extraction' | 'ontology' | 'graph' | 'prolog' | 'complete';
  error?: string;
  core?: {
    method: string | null;
    dataset: string | null;
    accuracy: number | null;
    problem: string | null;
    contributions: string[];
    keyPoints: { label: string; value: string }[];
    entities: string[];
    extras?: {
      metric: string | null;
      limitations: string | null;
      futureWork: string | null;
      topic: string | null;
      keywords: string[];
      aiAssisted?: boolean;
      aiFilledFields?: string[];
    };
  };
  ontologyMatches?: {
    conceptId: string;
    confidence: number;
    matchType: 'exact' | 'alias' | 'fuzzy' | 'unknown';
    rawInput: string;
  }[];
  graph?: {
    nodes: { id: string; type: string; label: string; properties?: Record<string, unknown> }[];
    edges: { from: string; to: string; type: string; weight: number }[];
  };
  prologFacts?: { functor: string; args: string[] }[];
  gaps?: {
    missingFields: string[];
    missingSections: string[];
    unresolvedEntities: string[];
    coverageScore: number;
  };
  confidenceBreakdown?: {
    nlp: number;
    ontology: number;
    graph: number;
    prolog: number;
    coverage: number;
    overall: number;
    overallOutOf10: number;
  };
  confidence?: number;
  aiFallback?: {
    used: boolean;
    filledFields: string[];
    raw?: string;
    provider?: 'openai' | 'gemini';
    tokensUsed?: number;
    skippedReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const KeyPointSchema = new Schema({ label: String, value: String }, { _id: false });

const KnowledgeCoreSchema = new Schema(
  {
    method: { type: String, default: null },
    dataset: { type: String, default: null },
    accuracy: { type: Number, default: null },
    problem: { type: String, default: null },
    contributions: { type: [String], default: [] },
    keyPoints: { type: [KeyPointSchema], default: [] },
    entities: { type: [String], default: [] },
    extras: {
      type: new Schema(
        {
          metric: { type: String, default: null },
          limitations: { type: String, default: null },
          futureWork: { type: String, default: null },
          topic: { type: String, default: null },
          keywords: { type: [String], default: [] },
          aiAssisted: { type: Boolean, default: false },
          aiFilledFields: { type: [String], default: [] },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  { _id: false }
);

const OntologyMatchRefSchema = new Schema(
  {
    conceptId: { type: String, required: true },
    confidence: { type: Number, required: true },
    matchType: { type: String, enum: ['exact', 'alias', 'fuzzy', 'unknown'], required: true },
    rawInput: { type: String, required: true },
  },
  { _id: false }
);

const GraphNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, required: true },
    properties: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false }
);

const GraphEdgeSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    type: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false }
);

const GraphSchema = new Schema(
  { nodes: { type: [GraphNodeSchema], default: [] }, edges: { type: [GraphEdgeSchema], default: [] } },
  { _id: false }
);

const PrologFactSchema = new Schema(
  { functor: { type: String, required: true }, args: { type: [String], default: [] } },
  { _id: false }
);

const GapsSchema = new Schema(
  {
    missingFields: { type: [String], default: [] },
    missingSections: { type: [String], default: [] },
    unresolvedEntities: { type: [String], default: [] },
    coverageScore: { type: Number, required: true },
  },
  { _id: false }
);

const ConfidenceBreakdownSchema = new Schema(
  {
    nlp: { type: Number, required: true },
    ontology: { type: Number, required: true },
    graph: { type: Number, required: true },
    prolog: { type: Number, required: true },
    coverage: { type: Number, required: true },
    overall: { type: Number, required: true },
    overallOutOf10: { type: Number, required: true },
  },
  { _id: false }
);

const AIFallbackSchema = new Schema(
  {
    used: { type: Boolean, required: true },
    filledFields: { type: [String], default: [] },
    raw: { type: String, required: false },
    provider: { type: String, enum: ['openai', 'gemini'], required: false },
    tokensUsed: { type: Number, required: false },
    skippedReason: { type: String, required: false },
  },
  { _id: false }
);

const KnowledgeSchema = new Schema<KnowledgeDocument>(
  {
    noteId: { type: Schema.Types.ObjectId, ref: 'Note', required: true, unique: true },
    stage: {
      type: String,
      enum: ['pending', 'document', 'extraction', 'ontology', 'graph', 'prolog', 'complete'],
      required: true,
      default: 'pending',
    },
    error: { type: String, required: false },
    core: { type: KnowledgeCoreSchema, required: false },
    ontologyMatches: { type: [OntologyMatchRefSchema], default: undefined, required: false },
    graph: { type: GraphSchema, required: false },
    prologFacts: { type: [PrologFactSchema], default: undefined, required: false },
    gaps: { type: GapsSchema, required: false },
    confidenceBreakdown: { type: ConfidenceBreakdownSchema, required: false },
    confidence: { type: Number, min: 0, max: 1, required: false },
    aiFallback: { type: AIFallbackSchema, required: false },
  },
  { timestamps: true }
);

KnowledgeSchema.index({ noteId: 1 }, { unique: true });

export const Knowledge = models.Knowledge || model<KnowledgeDocument>('Knowledge', KnowledgeSchema);
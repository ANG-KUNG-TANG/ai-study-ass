// server/models/Knowledge.ts
//
// Legacy compatibility model.
//
// The canonical symbolic pipeline result is persisted through
// intelligence.service.ts. Do not reconnect automatic generation to this
// collection. Keep this model only while older code or data is migrated.

import mongoose from "mongoose";
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";
import type {
  OntologyMatchRef,
  PipelineStage,
} from "@/server/types/Knowledge";
import type {
  ConfidenceBreakdown,
} from "@/server/intelligence/types";
import type {
  AIProvider,
} from "@/server/entities/chat.entity";

export interface KnowledgePersistence {
  noteId: string;
  stage: PipelineStage;
  error?: string;

  core?: {
    method: string | null;
    dataset: string | null;
    accuracy: number | null;
    problem: string | null;
    contributions: string[];
    keyPoints: Array<{
      label: string;
      value: string;
    }>;
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

  ontologyMatches?: OntologyMatchRef[];

  graph?: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      properties?: Record<
        string,
        unknown
      >;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: string;
      weight: number;
    }>;
  };

  prologFacts?: Array<{
    functor: string;
    args: string[];
  }>;

  gaps?: {
    missingFields: string[];
    missingSections: string[];
    unresolvedEntities: string[];
    coverageScore: number;
  };

  confidenceBreakdown?: ConfidenceBreakdown;

  confidence?: number;

  aiFallback?: {
    used: boolean;
    filledFields: string[];
    raw?: string;
    provider?: Exclude<
      AIProvider,
      "symbolic"
    >;
    tokensUsed?: number;
    skippedReason?: string;
  };

  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type KnowledgeDocument =
  HydratedDocument<
    KnowledgePersistence
  >;

const keyPointSchema =
  new Schema(
    {
      label: {
        type: String,
        required: true,
      },

      value: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const knowledgeCoreSchema =
  new Schema(
    {
      method: {
        type: String,
        default: null,
      },

      dataset: {
        type: String,
        default: null,
      },

      accuracy: {
        type: Number,
        default: null,
      },

      problem: {
        type: String,
        default: null,
      },

      contributions: {
        type: [String],
        default: [],
      },

      keyPoints: {
        type: [
          keyPointSchema,
        ],
        default: [],
      },

      entities: {
        type: [String],
        default: [],
      },

      extras: {
        type: new Schema(
          {
            metric: {
              type: String,
              default: null,
            },

            limitations: {
              type: String,
              default: null,
            },

            futureWork: {
              type: String,
              default: null,
            },

            topic: {
              type: String,
              default: null,
            },

            keywords: {
              type: [String],
              default: [],
            },

            aiAssisted: {
              type: Boolean,
              default: false,
            },

            aiFilledFields: {
              type: [String],
              default: [],
            },
          },
          {
            _id: false,
          },
        ),
        required: false,
      },
    },
    {
      _id: false,
    },
  );

const ontologyMatchSchema =
  new Schema(
    {
      conceptId: {
        type: String,
        required: true,
      },

      confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },

      matchType: {
        type: String,
        enum: [
          "exact",
          "alias",
          "fuzzy",
          "unknown",
          "generated",
        ],
        required: true,
      },

      rawInput: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const graphNodeSchema =
  new Schema(
    {
      id: {
        type: String,
        required: true,
      },

      type: {
        type: String,
        required: true,
      },

      label: {
        type: String,
        required: true,
      },

      properties: {
        type:
          Schema.Types.Mixed,
        required: false,
      },
    },
    {
      _id: false,
    },
  );

const graphEdgeSchema =
  new Schema(
    {
      from: {
        type: String,
        required: true,
      },

      to: {
        type: String,
        required: true,
      },

      type: {
        type: String,
        required: true,
      },

      weight: {
        type: Number,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const graphSchema =
  new Schema(
    {
      nodes: {
        type: [
          graphNodeSchema,
        ],
        default: [],
      },

      edges: {
        type: [
          graphEdgeSchema,
        ],
        default: [],
      },
    },
    {
      _id: false,
    },
  );

const prologFactSchema =
  new Schema(
    {
      functor: {
        type: String,
        required: true,
      },

      args: {
        type: [String],
        default: [],
      },
    },
    {
      _id: false,
    },
  );

const gapsSchema =
  new Schema(
    {
      missingFields: {
        type: [String],
        default: [],
      },

      missingSections: {
        type: [String],
        default: [],
      },

      unresolvedEntities: {
        type: [String],
        default: [],
      },

      coverageScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
    },
    {
      _id: false,
    },
  );

const aiFallbackSchema =
  new Schema(
    {
      used: {
        type: Boolean,
        required: true,
      },

      filledFields: {
        type: [String],
        default: [],
      },

      raw: {
        type: String,
        required: false,
      },

      provider: {
        type: String,
        enum: [
          "openai",
          "gemini",
        ],
        required: false,
      },

      tokensUsed: {
        type: Number,
        min: 0,
        required: false,
      },

      skippedReason: {
        type: String,
        required: false,
      },
    },
    {
      _id: false,
    },
  );

const knowledgeSchema =
  new Schema<KnowledgePersistence>(
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
          "pending",
          "document",
          "extraction",
          "ontology",
          "graph",
          "prolog",
          "complete",
        ] satisfies PipelineStage[],
        required: true,
        default: "pending",
      },

      error: {
        type: String,
        required: false,
      },

      core: {
        type:
          knowledgeCoreSchema,
        required: false,
      },

      ontologyMatches: {
        type: [
          ontologyMatchSchema,
        ],
        default: undefined,
        required: false,
      },

      graph: {
        type: graphSchema,
        required: false,
      },

      prologFacts: {
        type: [
          prologFactSchema,
        ],
        default: undefined,
        required: false,
      },

      gaps: {
        type: gapsSchema,
        required: false,
      },

      // The confidence engine evolves independently from this legacy
      // compatibility model. Mixed preserves the complete canonical
      // ConfidenceBreakdown instead of silently dropping newly added scores.
      confidenceBreakdown: {
        type: Schema.Types.Mixed,
        required: false,
      },

      confidence: {
        type: Number,
        min: 0,
        max: 1,
        required: false,
      },

      aiFallback: {
        type:
          aiFallbackSchema,
        required: false,
      },

      processedAt: {
        type: Date,
        required: false,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Knowledge:
  Model<KnowledgePersistence> =
  (mongoose.models.Knowledge as
    | Model<KnowledgePersistence>
    | undefined) ??
  model<KnowledgePersistence>(
    "Knowledge",
    knowledgeSchema,
  );

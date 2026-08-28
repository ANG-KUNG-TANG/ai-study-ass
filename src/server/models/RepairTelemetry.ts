import mongoose, {
  Schema,
  type Model,
} from "mongoose";

import {
  REPAIR_FEATURES,
  type RepairFeature,
} from "@/server/types/repair";

export interface IRepairTelemetry {
  _id: string;
  noteId: string;
  userId: string;
  feature: RepairFeature;
  strategyVersion: string;

  repairNeeded: boolean;
  repairAttempted: boolean;
  repairCacheHit: boolean;
  repairAccepted: boolean;
  providerCallAvoided: boolean;

  evidenceCharacters: number;
  tokensUsed: number;
  gapCodes: string[];

  createdAt: Date;
}

const repairTelemetrySchema =
  new Schema<IRepairTelemetry>(
    {
      _id: {
        type: String,
        required: true,
      },
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
      feature: {
        type: String,
        enum: REPAIR_FEATURES,
        required: true,
        index: true,
      },
      strategyVersion: {
        type: String,
        required: true,
      },
      repairNeeded: {
        type: Boolean,
        required: true,
      },
      repairAttempted: {
        type: Boolean,
        required: true,
      },
      repairCacheHit: {
        type: Boolean,
        required: true,
      },
      repairAccepted: {
        type: Boolean,
        required: true,
      },
      providerCallAvoided: {
        type: Boolean,
        required: true,
      },
      evidenceCharacters: {
        type: Number,
        min: 0,
        required: true,
        default: 0,
      },
      tokensUsed: {
        type: Number,
        min: 0,
        required: true,
        default: 0,
      },
      gapCodes: {
        type: [String],
        required: true,
        default: [],
      },
    },
    {
      timestamps: {
        createdAt: true,
        updatedAt: false,
      },
      versionKey: false,
    },
  );

repairTelemetrySchema.index({
  noteId: 1,
  createdAt: -1,
});

repairTelemetrySchema.index({
  feature: 1,
  createdAt: -1,
});

/**
 * Repair telemetry is diagnostic, not the source of truth for provider cost.
 * Keep a rolling 90-day window so observability does not grow without bound.
 */
repairTelemetrySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export const RepairTelemetry:
  Model<IRepairTelemetry> =
  (mongoose.models.RepairTelemetry as
    | Model<IRepairTelemetry>
    | undefined) ??
  mongoose.model<IRepairTelemetry>(
    "RepairTelemetry",
    repairTelemetrySchema,
  );

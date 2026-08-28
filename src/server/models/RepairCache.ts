import mongoose, {
  Schema,
  type Model,
} from "mongoose";

import {
  REPAIR_FEATURES,
  type RepairFeature,
} from "@/server/types/repair";

export interface IRepairCache {
  _id: string;
  noteId: string;
  userId: string;
  feature: RepairFeature;
  sourceFingerprint: string;
  variantFingerprint: string;
  gapFingerprint: string;
  strategyVersion: string;
  payload: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const repairCacheSchema =
  new Schema<IRepairCache>(
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
      sourceFingerprint: {
        type: String,
        required: true,
      },
      variantFingerprint: {
        type: String,
        required: true,
      },
      gapFingerprint: {
        type: String,
        required: true,
      },
      strategyVersion: {
        type: String,
        required: true,
      },
      payload: {
        type: Schema.Types.Mixed,
        required: true,
      },
      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

repairCacheSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

repairCacheSchema.index({
  noteId: 1,
  feature: 1,
  updatedAt: -1,
});

export const RepairCache:
  Model<IRepairCache> =
  (mongoose.models.RepairCache as
    | Model<IRepairCache>
    | undefined) ??
  mongoose.model<IRepairCache>(
    "RepairCache",
    repairCacheSchema,
  );

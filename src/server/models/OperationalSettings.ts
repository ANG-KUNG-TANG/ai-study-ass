import mongoose, { Schema, type Model } from "mongoose";

import {
  ADMIN_FILE_TYPES,
  OPERATIONAL_SETTINGS_ID,
  type AdminFileType,
} from "@/server/entities/operational-settings.entity";

export interface OperationalSettingsPersistence {
  _id: typeof OPERATIONAL_SETTINGS_ID;
  uploadsEnabled: boolean;
  aiGenerationEnabled: boolean;
  allowedFileTypes: AdminFileType[];
  maxUploadSizeBytes: number;
  auditRetentionDays: number;
  contentRetentionDays: number;
  pricing: {
    openai: {
      inputPerMillionUsd: number;
      outputPerMillionUsd: number;
    };
    gemini: {
      inputPerMillionUsd: number;
      outputPerMillionUsd: number;
    };
  };
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const providerPricingSchema = new Schema(
  {
    inputPerMillionUsd: { type: Number, required: true, min: 0 },
    outputPerMillionUsd: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const operationalSettingsSchema = new Schema<OperationalSettingsPersistence>(
  {
    _id: {
      type: String,
      required: true,
      enum: [OPERATIONAL_SETTINGS_ID],
    },
    uploadsEnabled: { type: Boolean, required: true },
    aiGenerationEnabled: { type: Boolean, required: true },
    allowedFileTypes: {
      type: [String],
      enum: ADMIN_FILE_TYPES,
      required: true,
    },
    maxUploadSizeBytes: { type: Number, required: true, min: 1024 },
    auditRetentionDays: { type: Number, required: true, min: 30 },
    contentRetentionDays: { type: Number, required: true, min: 0 },
    pricing: {
      openai: { type: providerPricingSchema, required: true },
      gemini: { type: providerPricingSchema, required: true },
    },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const OperationalSettings: Model<OperationalSettingsPersistence> =
  (mongoose.models.OperationalSettings as
    | Model<OperationalSettingsPersistence>
    | undefined) ??
  mongoose.model<OperationalSettingsPersistence>(
    "OperationalSettings",
    operationalSettingsSchema,
  );

import mongoose, { Schema, type Model } from "mongoose";

export interface UserAIPolicyPersistence {
  _id: string;
  enabled: boolean;
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const userAIPolicySchema = new Schema<UserAIPolicyPersistence>(
  {
    _id: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: true },
    dailyRequestLimit: { type: Number, default: null, min: 0 },
    dailyTokenLimit: { type: Number, default: null, min: 0 },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

export const UserAIPolicy: Model<UserAIPolicyPersistence> =
  (mongoose.models.UserAIPolicy as Model<UserAIPolicyPersistence> | undefined) ??
  mongoose.model<UserAIPolicyPersistence>("UserAIPolicy", userAIPolicySchema);

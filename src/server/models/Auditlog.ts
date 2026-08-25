// server/models/AuditLog.ts
import mongoose from "mongoose";
import {
  Schema,
  model,
} from "mongoose";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  categoryForAuditAction,
  type AuditActorRole,
  type AuditAction,
  type AuditCategory,
  type AuditStatus,
} from "@/server/entities/auditLog.entity";

export interface AuditLogDocument {
  _id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: AuditActorRole;
  action: AuditAction;
  category: AuditCategory;
  status: AuditStatus;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    _id: { type: String, required: true }, // string UUID, same convention as User/Note
    actorId: { type: String, default: null, index: true },
    actorEmail: { type: String, default: null },
    actorRole: {
      type: String,
      enum: ["user", "admin", "system"],
      default: function (this: AuditLogDocument) {
        return this.actorId ? "user" : "system";
      },
      index: true,
    },
    action: { type: String, enum: [...AUDIT_ACTIONS], required: true, index: true },
    category: {
      type: String,
      enum: [...AUDIT_CATEGORIES],
      required: true,
      index: true,
      default: function (this: AuditLogDocument) {
        return categoryForAuditAction(this.action);
      },
    },
    status: { type: String, enum: ["success", "failure"], default: "success", index: true },
    targetType: { type: String, required: false },
    targetId: { type: String, required: false },
    metadata: { type: Schema.Types.Mixed, required: false },
    reason: { type: String, required: false },
    ipAddress: { type: String, required: false },
    userAgent: { type: String, required: false },
    requestId: { type: String, required: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Feed is always sorted newest-first.
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ category: 1, status: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });


export const AuditLog = mongoose.models.AuditLog || model<AuditLogDocument>("AuditLog", AuditLogSchema);

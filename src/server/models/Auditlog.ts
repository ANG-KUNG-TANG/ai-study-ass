// server/models/AuditLog.ts
import mongoose from "mongoose";
import {
  Schema,
  model,
} from "mongoose";
import type { AuditAction } from "@/server/entities/auditLog.entity";

export interface AuditLogDocument {
  _id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AUDIT_ACTIONS: AuditAction[] = [
  "auth.login", "auth.logout", "auth.register",
  "note.uploaded", "note.deleted",
  "quiz.generated", "flashcards.generated", "summary.generated",
  "rate_limit.hit",
  "admin.role_changed", "admin.user_banned", "admin.user_unbanned",
];

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    _id: { type: String, required: true }, // string UUID, same convention as User/Note
    actorId: { type: String, default: null, index: true },
    actorEmail: { type: String, default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    targetType: { type: String, required: false },
    targetId: { type: String, required: false },
    metadata: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Feed is always sorted newest-first.
AuditLogSchema.index({ createdAt: -1 });


export const AuditLog = mongoose.models.AuditLog || model<AuditLogDocument>("AuditLog", AuditLogSchema);
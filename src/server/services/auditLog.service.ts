// server/services/auditLog.service.ts
import * as auditLogRepo from "@/server/repositories/auditLog.repo";
import type { AuditAction } from "@/server/entities/auditLog.entity";

export interface LogActivityInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Call this from anywhere (auth, notes, quiz/flashcard/summary generation,
 * rate limiter, admin actions). Never throws — a broken activity feed
 * should never take down the feature it's logging.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await auditLogRepo.log({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    });
  } catch (err) {
    console.error("Failed to write audit log", { action: input.action, err });
  }
}

export async function getRecentActivity(limit: number = 20) {
  const entries = await auditLogRepo.findRecent(limit);
  return entries.map((e) => ({ id: e.id, text: e.describe(), action: e.action, createdAt: e.createdAt }));
}
// server/services/auditLog.service.ts

import * as auditLogRepo from "@/server/repositories/auditLog.repo";
import type {
  AuditAction,
  AuditLogEntity,
} from "@/server/entities/auditLog.entity";
import {
  buildPaginationMeta,
  type PaginationMeta,
} from "@/server/utils/response";

export interface LogActivityInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminActivityItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  text: string;
  createdAt: Date;
}

export interface ActivityPage {
  data: AdminActivityItem[];
  meta: PaginationMeta;
}

function toActivityItem(entry: AuditLogEntity): AdminActivityItem {
  return {
    id: entry.id,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
    text: entry.describe(),
    createdAt: entry.createdAt,
  };
}

/**
 * Activity logging must never break the feature that produced the event.
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
  } catch (error) {
    console.error("Failed to write audit log", {
      action: input.action,
      error,
    });
  }
}

export async function listActivity(
  page: number = 1,
  limit: number = 20,
): Promise<ActivityPage> {
  const safePage = Math.max(1, Math.floor(page));

  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

  const result = await auditLogRepo.findPage(safePage, safeLimit);

  return {
    data: result.data.map(toActivityItem),

    meta: buildPaginationMeta(result.total, safePage, safeLimit),
  };
}

export async function getRecentActivity(
  limit: number = 20,
): Promise<AdminActivityItem[]> {
  const result = await listActivity(1, limit);

  return result.data;
}

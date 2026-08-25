// server/services/auditLog.service.ts

import * as auditLogRepo from "@/server/repositories/auditLog.repo";
import type {
  AuditActorRole,
  AuditAction,
  AuditCategory,
  AuditLogEntity,
  AuditStatus,
} from "@/server/entities/auditLog.entity";
import {
  buildPaginationMeta,
  type PaginationMeta,
} from "@/server/utils/response";
import { logger } from "@/server/utils/logger";

export interface LogActivityInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: AuditActorRole;
  action: AuditAction;
  category?: AuditCategory;
  status?: AuditStatus;
  targetType?: string;
  targetId?: string;
  metadata?: Record<
    string,
    unknown
  >;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AdminActivityItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: AuditActorRole;
  action: AuditAction;
  category: AuditCategory;
  status: AuditStatus;
  targetType?: string;
  targetId?: string;
  metadata?: Record<
    string,
    unknown
  >;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  text: string;
  createdAt: Date;
}

export interface ActivityPage {
  data: AdminActivityItem[];
  meta: PaginationMeta;
}

function toActivityItem(
  entry: AuditLogEntity,
): AdminActivityItem {
  return {
    id:
      entry.id,
    actorId:
      entry.actorId,
    actorEmail:
      entry.actorEmail,
    actorRole:
      entry.actorRole,
    action:
      entry.action,
    category:
      entry.category,
    status:
      entry.status,
    targetType:
      entry.targetType,
    targetId:
      entry.targetId,
    metadata:
      entry.metadata,
    reason:
      entry.reason,
    ipAddress:
      entry.ipAddress,
    userAgent:
      entry.userAgent,
    requestId:
      entry.requestId,
    text:
      entry.describe(),
    createdAt:
      entry.createdAt,
  };
}

const REDACTED_KEYS = /password|token|secret|authorization|cookie|api[-_]?key/i;

function sanitizeMetadata(value: unknown, depth: number = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => sanitizeMetadata(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        REDACTED_KEYS.test(key) ? "[redacted]" : sanitizeMetadata(entry, depth + 1),
      ]),
    );
  }
  if (typeof value === "string" && value.length > 2_000) {
    return `${value.slice(0, 2_000)}…`;
  }
  return value;
}

/**
 * Activity logging must never break the feature that produced the event.
 */
export async function logActivity(
  input: LogActivityInput,
): Promise<void> {
  try {
    await auditLogRepo.log({
      actorId:
        input.actorId ??
        null,
      actorEmail:
        input.actorEmail ??
        null,
      actorRole:
        input.actorRole,
      action:
        input.action,
      category:
        input.category,
      status:
        input.status,
      targetType:
        input.targetType,
      targetId:
        input.targetId,
      metadata:
        sanitizeMetadata(input.metadata) as Record<string, unknown> | undefined,
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    });
  } catch (error) {
    logger.error("Failed to write audit log", {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface ActivityQuery {
  page?: number;
  limit?: number;
  search?: string;
  action?: AuditAction;
  category?: AuditCategory;
  status?: AuditStatus;
  targetType?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
}

export async function listActivity(
  queryOrPage: ActivityQuery | number = {},
  legacyLimit: number = 20,
): Promise<ActivityPage> {
  const query = typeof queryOrPage === "number"
    ? { page: queryOrPage, limit: legacyLimit }
    : queryOrPage;
  const safePage =
    Math.max(
      1,
      Math.floor(query.page ?? 1),
    );

  const safeLimit =
    Math.min(
      100,
      Math.max(
        1,
        Math.floor(query.limit ?? 20),
      ),
    );

  const result =
    await auditLogRepo.findPage(
      { ...query, page: safePage, limit: safeLimit },
    );

  return {
    data:
      result.data.map(
        toActivityItem,
      ),

    meta:
      buildPaginationMeta(
        result.total,
        safePage,
        safeLimit,
      ),
  };
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportActivityCsv(
  query: Omit<ActivityQuery, "page" | "limit">,
): Promise<string> {
  const entries = await auditLogRepo.findForExport(query);
  const header = [
    "timestamp", "actorEmail", "actorRole", "action", "category", "status",
    "targetType", "targetId", "reason", "ipAddress", "requestId", "metadata",
  ];
  const rows = entries.map((entry) => [
    entry.createdAt.toISOString(), entry.actorEmail, entry.actorRole, entry.action,
    entry.category, entry.status, entry.targetType, entry.targetId, entry.reason,
    entry.ipAddress, entry.requestId, entry.metadata,
  ].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...rows].join("\n");
}

export async function getRecentActivity(
  limit: number = 20,
): Promise<
  AdminActivityItem[]
> {
  const result =
    await listActivity(
      1,
      limit,
    );

  return result.data;
}

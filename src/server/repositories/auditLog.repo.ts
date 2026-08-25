// server/repositories/auditLog.repo.ts

import {
  randomUUID,
} from "crypto";
import {
  AuditLog,
} from "@/server/models/Auditlog";
import {
  AuditLogEntity,
  categoryForAuditAction,
  type AuditActorRole,
  type AuditAction,
  type AuditCategory,
  type AuditLogProps,
  type AuditStatus,
} from "@/server/entities/auditLog.entity";

function toEntity(
  doc: any,
): AuditLogEntity {
  const props:
    AuditLogProps = {
      id:
        String(doc._id),
      actorId:
        doc.actorId,
      actorEmail:
        doc.actorEmail,
      actorRole:
        doc.actorRole,
      action:
        doc.action,
      category:
        doc.category,
      status:
        doc.status,
      targetType:
        doc.targetType,
      targetId:
        doc.targetId,
      metadata:
        doc.metadata,
      reason:
        doc.reason,
      ipAddress:
        doc.ipAddress,
      userAgent:
        doc.userAgent,
      requestId:
        doc.requestId,
      createdAt:
        doc.createdAt,
    };

  return AuditLogEntity
    .fromPersistence(
      props,
    );
}

export interface LogEventInput {
  actorId: string | null;
  actorEmail: string | null;
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

export interface AuditLogQuery {
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

export interface AuditLogPage {
  data: AuditLogEntity[];
  total: number;
}

export async function log(
  input: LogEventInput,
): Promise<AuditLogEntity> {
  const doc =
    await AuditLog.create({
      _id:
        randomUUID(),
      ...input,
      actorRole: input.actorRole ?? (input.actorId ? "user" : "system"),
      category: input.category ?? categoryForAuditAction(input.action),
      status: input.status ?? (input.action === "auth.login_failed" ? "failure" : "success"),
    });

  return toEntity(
    doc,
  );
}

export async function findPage(
  query: AuditLogQuery,
): Promise<AuditLogPage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(500, Math.max(1, Math.floor(query.limit ?? 20)));
  const skip =
    (page - 1) *
    limit;

  const filter = buildFilter(query);

  const [
    docs,
    total,
  ] =
    await Promise.all([
      AuditLog.find(filter)
        .sort({
          createdAt:
            -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      AuditLog.countDocuments(filter).exec(),
    ]);

  return {
    data:
      docs.map(
        toEntity,
      ),
    total,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(query: AuditLogQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = query.action;
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.actorId) filter.actorId = query.actorId;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { actorEmail: pattern },
      { targetId: pattern },
      { targetType: pattern },
      { reason: pattern },
      { requestId: pattern },
    ];
  }
  return filter;
}

export async function findRecent(
  limit: number = 20,
): Promise<
  AuditLogEntity[]
> {
  const result =
    await findPage({ page: 1, limit });

  return result.data;
}

export async function findByActor(
  actorId: string,
  limit: number = 20,
): Promise<
  AuditLogEntity[]
> {
  const docs =
    await AuditLog.find({
      actorId,
    })
      .sort({
        createdAt:
          -1,
      })
      .limit(limit)
      .lean()
      .exec();

  return docs.map(
    toEntity,
  );
}

export async function findSince(
  since: Date,
  limit: number = 2_000,
): Promise<AuditLogEntity[]> {
  const safeLimit = Math.min(
    5_000,
    Math.max(1, Math.floor(limit)),
  );

  const docs = await AuditLog.find({
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean()
    .exec();

  return docs.map(toEntity);
}

export async function findForExport(
  query: Omit<AuditLogQuery, "page" | "limit">,
  limit: number = 5_000,
): Promise<AuditLogEntity[]> {
  const safeLimit = Math.min(10_000, Math.max(1, Math.floor(limit)));
  const docs = await AuditLog.find(buildFilter(query))
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean()
    .exec();
  return docs.map(toEntity);
}

export async function countBefore(before: Date): Promise<number> {
  return AuditLog.countDocuments({ createdAt: { $lt: before } }).exec();
}

export async function deleteBefore(before: Date): Promise<number> {
  const result = await AuditLog.deleteMany({ createdAt: { $lt: before } }).exec();
  return result.deletedCount;
}

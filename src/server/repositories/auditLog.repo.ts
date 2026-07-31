// server/repositories/auditLog.repo.ts
import { randomUUID } from "crypto";
import { AuditLog } from "@/server/models/Auditlog";
import { AuditLogEntity, type AuditLogProps, type AuditAction } from "@/server/entities/auditLog.entity";

function toEntity(doc: any): AuditLogEntity {
  const props: AuditLogProps = {
    id: String(doc._id),
    actorId: doc.actorId,
    actorEmail: doc.actorEmail,
    action: doc.action,
    targetType: doc.targetType,
    targetId: doc.targetId,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
  };
  return AuditLogEntity.fromPersistence(props);
}

export interface LogEventInput {
  actorId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function log(input: LogEventInput): Promise<AuditLogEntity> {
  const doc = await AuditLog.create({ _id: randomUUID(), ...input });
  return toEntity(doc);
}

export async function findRecent(limit: number = 20): Promise<AuditLogEntity[]> {
  const docs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean().exec();
  return docs.map(toEntity);
}

export async function findByActor(actorId: string, limit: number = 20): Promise<AuditLogEntity[]> {
  const docs = await AuditLog.find({ actorId }).sort({ createdAt: -1 }).limit(limit).lean().exec();
  return docs.map(toEntity);
}
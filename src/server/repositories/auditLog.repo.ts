// server/repositories/auditLog.repo.ts

import {
  randomUUID,
} from "crypto";
import {
  AuditLog,
} from "@/server/models/Auditlog";
import {
  AuditLogEntity,
  type AuditAction,
  type AuditLogProps,
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
      action:
        doc.action,
      targetType:
        doc.targetType,
      targetId:
        doc.targetId,
      metadata:
        doc.metadata,
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
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<
    string,
    unknown
  >;
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
    });

  return toEntity(
    doc,
  );
}

export async function findPage(
  page: number,
  limit: number,
): Promise<AuditLogPage> {
  const skip =
    (page - 1) *
    limit;

  const [
    docs,
    total,
  ] =
    await Promise.all([
      AuditLog.find({})
        .sort({
          createdAt:
            -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      AuditLog.countDocuments(
        {},
      ).exec(),
    ]);

  return {
    data:
      docs.map(
        toEntity,
      ),
    total,
  };
}

export async function findRecent(
  limit: number = 20,
): Promise<
  AuditLogEntity[]
> {
  const result =
    await findPage(
      1,
      limit,
    );

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

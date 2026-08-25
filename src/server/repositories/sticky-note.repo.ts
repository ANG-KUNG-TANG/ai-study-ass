import { StickyNote } from "@/server/models/StickyNote";
import { StickyNoteEntity } from "@/server/entities/sticky-note.entity";

function toEntity(doc: {
  _id: unknown;
  userId: unknown;
  content: string;
  sourcePath?: string;
  createdAt: Date;
  updatedAt: Date;
}): StickyNoteEntity {
  return StickyNoteEntity.fromPersistence({
    id: String(doc._id),
    userId: String(doc.userId),
    content: doc.content,
    sourcePath: doc.sourcePath ?? "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export async function create(
  entity: StickyNoteEntity,
): Promise<StickyNoteEntity> {
  const data = entity.toPublic();

  const doc = await StickyNote.create({
    _id: data.id,
    userId: entity.userId,
    content: data.content,
    sourcePath: data.sourcePath,
  });

  return toEntity(doc.toObject());
}

export async function findRecentByUser(
  userId: string,
  limit: number,
): Promise<StickyNoteEntity[]> {
  const docs = await StickyNote.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map(toEntity);
}

export async function deleteByIdAndUserId(
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await StickyNote.deleteOne({ _id: id, userId }).exec();
  return result.deletedCount === 1;
}

export async function deleteByUserId(userId: string): Promise<number> {
  const result = await StickyNote.deleteMany({ userId }).exec();
  return result.deletedCount ?? 0;
}

import { Note } from "../models/Note";
import { NoteEntity } from "../entities/note.entity";
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "../utils/constants";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoteQueryOptions {
  page?: number;
  limit?: number;
  search?: string;               // matches title or fileName substring
  fileType?: "pdf" | "docx";
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedNotes {
  data: NoteEntity[];
  total: number;
  page: number;
  limit: number;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toEntity(doc: any): NoteEntity {
  return NoteEntity.fromPersistence({
    id: doc._id,
    userId: doc.userId,
    title: doc.title,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    content: doc.content,
    summary: doc.summary ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

// ─── Read — single record ──────────────────────────────────────────────────────

export async function findById(id: string): Promise<NoteEntity | null> {
  const doc = await Note.findById(id).lean().exec();
  if (!doc) return null;
  return toEntity(doc);
}

export async function findByIdOrThrow(id: string): Promise<NoteEntity> {
  const note = await findById(id);
  if (!note) throw new NotFoundError("Note");
  return note;
}

export async function findByIdAndUserId(id: string, userId: string): Promise<NoteEntity | null> {
  const doc = await Note.findOne({ _id: id, userId }).lean().exec();
  if (!doc) return null;
  return toEntity(doc);
}

export async function existsById(id: string): Promise<boolean> {
  return Boolean(await Note.exists({ _id: id }));
}

// ─── Read — list ──────────────────────────────────────────────────────────────
// Mirrors user.repo.ts's findMany() pattern: service layer passes filters,
// repo just executes and paginates. This is what note.service.ts's
// listNotes() calls.

export async function findManyByUser(
  userId: string,
  options: NoteQueryOptions = {}
): Promise<PaginatedNotes> {
  const page = Math.max(1, options.page ?? DEFAULT_PAGE);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  const sortBy = options.sortBy ?? "createdAt";

  const filter: Record<string, unknown> = { userId };
  if (options.fileType) filter.fileType = options.fileType;
  if (options.search) {
    const regex = new RegExp(options.search.trim(), "i");
    filter.$or = [{ title: regex }, { fileName: regex }];
  }

  const [docs, total] = await Promise.all([
    Note.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Note.countDocuments(filter),
  ]);

  return {
    data: docs.map(toEntity),
    total,
    page,
    limit,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function create(entity: NoteEntity): Promise<NoteEntity> {
  const data = entity.toPublic();
  const doc = await Note.create({
    _id: data.id,
    userId: data.userId,
    title: data.title,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    content: data.content,
    summary: data.summary,
  });
  logger.info("Note created", { noteId: String(doc._id), userId: data.userId });
  return toEntity(doc.toObject());
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateSummary(id: string, summary: string): Promise<void> {
  await Note.findByIdAndUpdate(id, { summary, updatedAt: new Date() });
  logger.info("Note summary updated", { noteId: id });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteById(id: string): Promise<void> {
  await Note.findByIdAndDelete(id);
  logger.info("Note deleted", { noteId: id });
}
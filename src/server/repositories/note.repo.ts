import { Note } from "../models/Note";
import { NoteEntity } from "../entities/note.entity";
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "../utils/constants";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NoteQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  fileType?: "pdf" | "docx";
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface NoteListItem {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: "pdf" | "docx";
  fileSize: number;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedNoteList {
  data: NoteListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedNotes {
  data: NoteEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminNoteQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  fileType?: "pdf" | "docx";
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

// ─── Mapper ───────────────────────────────────────────────────────────────────
function toEntity(doc: {
  _id: unknown;
  userId: unknown;
  title: string;
  fileName: string;
  fileType: "pdf" | "docx";
  fileSize: number;
  content: string;
  summary?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NoteEntity {
  return NoteEntity.fromPersistence({
    id: String(doc._id),
    userId: String(doc.userId),
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

function toListItem(doc: {
  _id: unknown;
  userId: unknown;
  title: string;
  fileName: string;
  fileType: "pdf" | "docx";
  fileSize: number;
  summary?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NoteListItem {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    title: doc.title,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    summary: doc.summary ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ─── Read — single record ─────────────────────────────────────────────────────
export async function findById(id: string): Promise<NoteEntity | null> {
  const doc = await Note.findById(id).lean().exec();
  return doc ? toEntity(doc) : null;
}

export async function findByIdOrThrow(id: string): Promise<NoteEntity> {
  const note = await findById(id);
  if (!note) throw new NotFoundError("Note");
  return note;
}

export async function findByIdAndUserId(
  id: string,
  userId: string,
): Promise<NoteEntity | null> {
  const doc = await Note.findOne({ _id: id, userId }).lean().exec();
  return doc ? toEntity(doc) : null;
}

export async function existsById(id: string): Promise<boolean> {
  return Boolean(await Note.exists({ _id: id }));
}

// ─── Read — lists ─────────────────────────────────────────────────────────────
export async function findManyByUser(
  userId: string,
  options: NoteQueryOptions = {},
): Promise<PaginatedNoteList> {
  const page = Math.max(1, options.page ?? DEFAULT_PAGE);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  const sortBy = options.sortBy ?? "createdAt";

  const filter: Record<string, unknown> = { userId };

  if (options.fileType) filter.fileType = options.fileType;

  if (options.search?.trim()) {
    const regex = new RegExp(options.search.trim(), "i");
    filter.$or = [{ title: regex }, { fileName: regex }];
  }

  const [docs, total] = await Promise.all([
    Note.find(filter)
      .select({
        userId: 1,
        title: 1,
        fileName: 1,
        fileType: 1,
        fileSize: 1,
        summary: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Note.countDocuments(filter),
  ]);

  return {
    data: docs.map(toListItem),
    total,
    page,
    limit,
  };
}

export async function findManyAdmin(
  options: AdminNoteQueryOptions = {},
): Promise<PaginatedNotes> {
  const page = Math.max(1, options.page ?? DEFAULT_PAGE);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  const sortBy = options.sortBy ?? "createdAt";

  const filter: Record<string, unknown> = {};

  if (options.fileType) filter.fileType = options.fileType;

  if (options.search?.trim()) {
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

export async function findIdsByUserId(
  userId: string,
): Promise<string[]> {
  const docs = await Note.find(
    { userId },
    { _id: 1 },
  ).lean().exec();

  return docs.map((doc: { _id: unknown }) => String(doc._id));
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

  logger.info("Note created", {
    noteId: String(doc._id),
    userId: data.userId,
  });

  return toEntity(doc.toObject());
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateSummary(
  id: string,
  summary: string,
): Promise<NoteEntity> {
  const doc = await Note.findByIdAndUpdate(
    id,
    {
      $set: {
        summary,
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  )
    .lean()
    .exec();

  if (!doc) throw new NotFoundError("Note");

  logger.info("Note study notes updated", {
    noteId: id,
    summaryLength: summary.length,
  });

  return toEntity(doc);
}

export async function count(): Promise<number> {
  return Note.countDocuments();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function deleteById(id: string): Promise<void> {
  await Note.findByIdAndDelete(id);
  logger.info("Note deleted", { noteId: id });
}

export async function deleteByUserId(userId: string): Promise<number> {
  const result = await Note.deleteMany({ userId });
  return result.deletedCount ?? 0;
}

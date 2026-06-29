import { Types } from "mongoose";

// ─── Validation rules (single source of truth) ────────────────────────────────
export const NOTE_RULES = {
  TITLE_MIN: 1,
  TITLE_MAX: 200,
  CONTENT_MAX: 500_000, // ~500k chars ≈ large academic paper
  SUMMARY_MAX: 5_000,
  FILE_NAME_MAX: 255,
} as const;

export type NoteFileType = "pdf" | "docx";
/** Alias — keeps upload.service.ts import compatible */
export type FileType = NoteFileType;

// ─── Public shape ─────────────────────────────────────────────────────────────
export interface NotePublic {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: NoteFileType;
  fileSize: number;
  content: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Create input ─────────────────────────────────────────────────────────────
export interface CreateNoteInput {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: NoteFileType;
  fileSize: number;
  content: string;
}

// ─── Entity ───────────────────────────────────────────────────────────────────
export class NoteEntity {
  #id: string;
  #userId: string;
  #title: string;
  #fileName: string;
  #fileType: NoteFileType;
  #fileSize: number;
  #content: string;
  #summary: string | null;
  #createdAt: Date;
  #updatedAt: Date;

  private constructor(data: {
    id: string;
    userId: string;
    title: string;
    fileName: string;
    fileType: NoteFileType;
    fileSize: number;
    content: string;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.#id = data.id;
    this.#userId = data.userId;
    this.#title = data.title.trim();
    this.#fileName = data.fileName.trim();
    this.#fileType = data.fileType;
    this.#fileSize = data.fileSize;
    this.#content = data.content;
    this.#summary = data.summary;
    this.#createdAt = data.createdAt;
    this.#updatedAt = data.updatedAt;
  }

  // ─── Factory ────────────────────────────────────────────────────────────────

  static create(input: CreateNoteInput): NoteEntity {
    const now = new Date();
    return new NoteEntity({
      ...input,
      summary: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(data: {
    id: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    title: string;
    fileName: string;
    fileType: NoteFileType;
    fileSize: number;
    content: string;
    summary?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): NoteEntity {
    return new NoteEntity({
      id: data.id.toString(),
      userId: data.userId.toString(),
      title: data.title,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      content: data.content,
      summary: data.summary ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  // ─── Getters ────────────────────────────────────────────────────────────────
  get id(): string { return this.#id; }
  get userId(): string { return this.#userId; }
  get title(): string { return this.#title; }
  get fileName(): string { return this.#fileName; }
  get fileType(): NoteFileType { return this.#fileType; }
  get fileSize(): number { return this.#fileSize; }
  get content(): string { return this.#content; }
  get summary(): string | null { return this.#summary; }
  get createdAt(): Date { return this.#createdAt; }
  get updatedAt(): Date { return this.#updatedAt; }

  // ─── Business rules ──────────────────────────────────────────────────────────

  belongsTo(userId: string): boolean {
    return this.#userId === userId;
  }

  updateSummary(summary: string): void {
    this.#summary = summary.trim();
    this.#updatedAt = new Date();
  }

  // ─── Serialisation ───────────────────────────────────────────────────────────

  toPublic(): NotePublic {
    return {
      id: this.#id,
      userId: this.#userId,
      title: this.#title,
      fileName: this.#fileName,
      fileType: this.#fileType,
      fileSize: this.#fileSize,
      content: this.#content,
      summary: this.#summary,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
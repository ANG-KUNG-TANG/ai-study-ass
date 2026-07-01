import { Types } from "mongoose";
import { ValidationError } from "@/server/utils/errors";

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

// ─── Validation ───────────────────────────────────────────────────────────────
// Added for consistency with chat_entity.ts / flashcard_entity.ts / quiz_entity.ts /
// user_entity.ts, which all validate on .create(). NOTE_RULES previously existed
// but was never enforced.

function validateTitle(title: string): void {
  const trimmed = title.trim();
  if (trimmed.length < NOTE_RULES.TITLE_MIN) {
    throw new ValidationError("Validation failed", { title: "Title is required" });
  }
  if (trimmed.length > NOTE_RULES.TITLE_MAX) {
    throw new ValidationError("Validation failed", {
      title: `Title cannot exceed ${NOTE_RULES.TITLE_MAX} characters`,
    });
  }
}

function validateContent(content: string): void {
  if (content.length > NOTE_RULES.CONTENT_MAX) {
    throw new ValidationError("Validation failed", {
      content: `Content cannot exceed ${NOTE_RULES.CONTENT_MAX} characters`,
    });
  }
}

function validateFileName(fileName: string): void {
  if (fileName.trim().length === 0) {
    throw new ValidationError("Validation failed", { fileName: "File name is required" });
  }
  if (fileName.length > NOTE_RULES.FILE_NAME_MAX) {
    throw new ValidationError("Validation failed", {
      fileName: `File name cannot exceed ${NOTE_RULES.FILE_NAME_MAX} characters`,
    });
  }
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
    validateTitle(input.title);
    validateFileName(input.fileName);
    validateContent(input.content);

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
    if (summary.length > NOTE_RULES.SUMMARY_MAX) {
      throw new ValidationError("Validation failed", {
        summary: `Summary cannot exceed ${NOTE_RULES.SUMMARY_MAX} characters`,
      });
    }
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
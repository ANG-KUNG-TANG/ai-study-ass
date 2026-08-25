import { randomUUID } from "node:crypto";
import { ValidationError } from "@/server/utils/errors";

export const STICKY_NOTE_RULES = {
  CONTENT_MAX: 10_000,
  SOURCE_PATH_MAX: 500,
} as const;

export interface StickyNotePublic {
  id: string;
  content: string;
  sourcePath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStickyNoteEntityInput {
  userId: string;
  content: string;
  sourcePath?: string;
}

function cleanContent(content: string): string {
  const cleaned = content.trim();

  if (!cleaned) {
    throw new ValidationError("Validation failed", {
      content: "Write something before saving",
    });
  }

  if (cleaned.length > STICKY_NOTE_RULES.CONTENT_MAX) {
    throw new ValidationError("Validation failed", {
      content: `Quick notes cannot exceed ${STICKY_NOTE_RULES.CONTENT_MAX} characters`,
    });
  }

  return cleaned;
}

export class StickyNoteEntity {
  #id: string;
  #userId: string;
  #content: string;
  #sourcePath: string;
  #createdAt: Date;
  #updatedAt: Date;

  private constructor(data: {
    id: string;
    userId: string;
    content: string;
    sourcePath: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.#id = data.id;
    this.#userId = data.userId;
    this.#content = data.content;
    this.#sourcePath = data.sourcePath;
    this.#createdAt = data.createdAt;
    this.#updatedAt = data.updatedAt;
  }

  static create(input: CreateStickyNoteEntityInput): StickyNoteEntity {
    const now = new Date();
    const sourcePath = input.sourcePath?.trim() ?? "";

    if (sourcePath.length > STICKY_NOTE_RULES.SOURCE_PATH_MAX) {
      throw new ValidationError("Validation failed", {
        sourcePath: `Source path cannot exceed ${STICKY_NOTE_RULES.SOURCE_PATH_MAX} characters`,
      });
    }

    return new StickyNoteEntity({
      id: randomUUID(),
      userId: input.userId,
      content: cleanContent(input.content),
      sourcePath,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(data: {
    id: string;
    userId: string;
    content: string;
    sourcePath?: string;
    createdAt: Date;
    updatedAt: Date;
  }): StickyNoteEntity {
    return new StickyNoteEntity({
      id: data.id,
      userId: data.userId,
      content: data.content,
      sourcePath: data.sourcePath ?? "",
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  get userId(): string {
    return this.#userId;
  }

  toPublic(): StickyNotePublic {
    return {
      id: this.#id,
      content: this.#content,
      sourcePath: this.#sourcePath,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}

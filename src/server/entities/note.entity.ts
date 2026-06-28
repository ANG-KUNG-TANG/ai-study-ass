import { maxLength } from "zod";
import { ValidationError } from "../utils/errors";

//Rules
export const NOTE_RULES = {
    title: { minLength: 1, maxLength: 200},
    context: { maxLength: 75_000},

    fileName: { maxLength: 255},
} as const;

export type NoteId = string;
export type FileType = "pdf" | "docx";

export interface NoteProps {
    id: NoteId;
    userId: string;
    title: string;
    fileName: string,
    fileType: FileType;
    fileSize: number;
    content: string;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotePublic {
    id: NoteId,
    userId: string;
    title: string;
    fileName: string;
    fileType: FileType;
    fileSize: number;
    content: string;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
}

//validaiton
function validateTitle(title: string): void {
    const t = title.trim();
    if (t.length< NOTE_RULES.title.maxLength){
        throw new ValidationError("Validation failed", { title: "Title is required"});
    }
    if (t.length> NOTE_RULES.title.maxLength){
        throw new ValidationError("Validation failed", {
            title: `Title cannot exceed ${NOTE_RULES.title.maxLength} characters`
        });
    }
}

//entity

export class NoteEntity {
    readonly #id: NoteId;
    readonly #userId: string;
    readonly #title: string;
    readonly #fileName: string;
    readonly #fileType: FileType;
    readonly #fileSize: number;
    readonly #content: string;
    readonly #summary: string | null;
    readonly #createdAt: Date;
    readonly #updatedAt: Date;

    private constructor(props: NoteProps){
        this.#id = props.id;
        this.#userId = props.userId;
        this.#title = props.title;
        this.#fileName = props.fileName;
        this.#fileType = props.fileType;
        this.#fileSize = props.fileSize;
        this.#content = props.content;
        this.#summary = props.summary;
        this.#createdAt = props.createdAt;
        this.#updatedAt = props.updatedAt;
    }

    get id(): NoteId { return this.#id;}
    get userId(): string { return this.#userId}
    get title(): string { return this.#title}
    get fileName(): string { return this.#fileName}
    get fileType(): FileType { return this.#fileType}
    get fileSize(): number { return this.#fileSize}
    get content(): string { return this.#content}
    get summary(): string | null { return this.#summary}
    get createdAt(): Date { return this.#createdAt}
    get updatedAt(): Date { return this.#updatedAt}

    static create(input: {
        id: NoteId;
        userId: string;
        title: string;
        fileName: string;
        fileType: FileType;
        fileSize: number;
        content: string
    }): NoteEntity {
        validateTitle(input.title);
        return new NoteEntity({
            ...input,
            title: input.title.trim(),
            summary: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static fromPersistence(props: NoteProps): NoteEntity {
        return new NoteEntity(props);
    }

    belongsTo(userId: string): boolean {
        return this.#userId === userId;
    }

    hasSummary(): boolean {
        return this.#summary !== null;
    }

    toPublic(): NotePublic {
        return {
            id: this.#id,
            userId: this.#userId,
            title: this.#title,
            fileName: this.#fileName,
            fileType: this.#fileType,
            fileSize: this.#fileSize,
            content : this.#content,
            summary: this.#summary,
            createdAt: this.#createdAt,
            updatedAt: this.#updatedAt,
        };
    }

    toPersistence (): NoteProps {
        return {
            id: this.#id,
            userId: this.#userId,
            title: this.#title,
            fileName: this.#fileName,
            fileType: this.#fileType,
            fileSize: this.#fileSize,
            content : this.#content,
            summary: this.#summary,
            createdAt: this.#createdAt,
            updatedAt: this.#updatedAt,
        };
    }
}
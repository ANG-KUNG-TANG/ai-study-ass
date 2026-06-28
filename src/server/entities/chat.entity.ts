import { ValidationError } from "@/server/utils/errors";

// ─── Rules ────────────────────────────────────────────────────────────────────

export const CHAT_RULES = {
  question: { minLength: 1, maxLength: 2000 },
  answer: { maxLength: 10_000 },
} as const;

export type ChatId = string;
export type AIProvider = "openai" | "gemini";

export interface ChatProps {
  id: ChatId;
  noteId: string;
  userId: string;
  question: string;
  answer: string;
  tokensUsed: number;
  provider: AIProvider;
  createdAt: Date;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateQuestion(question: string): void {
  if (!question.trim()) {
    throw new ValidationError("Validation failed", { question: "Question is required" });
  }
  if (question.length > CHAT_RULES.question.maxLength) {
    throw new ValidationError("Validation failed", {
      question: `Question cannot exceed ${CHAT_RULES.question.maxLength} characters`,
    });
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class ChatEntity {
  readonly #id: ChatId;
  readonly #noteId: string;
  readonly #userId: string;
  readonly #question: string;
  readonly #answer: string;
  readonly #tokensUsed: number;
  readonly #provider: AIProvider;
  readonly #createdAt: Date;

  private constructor(props: ChatProps) {
    this.#id = props.id;
    this.#noteId = props.noteId;
    this.#userId = props.userId;
    this.#question = props.question;
    this.#answer = props.answer;
    this.#tokensUsed = props.tokensUsed;
    this.#provider = props.provider;
    this.#createdAt = props.createdAt;
  }

  get id(): ChatId { return this.#id; }
  get noteId(): string { return this.#noteId; }
  get userId(): string { return this.#userId; }
  get question(): string { return this.#question; }
  get answer(): string { return this.#answer; }
  get tokensUsed(): number { return this.#tokensUsed; }
  get provider(): AIProvider { return this.#provider; }
  get createdAt(): Date { return this.#createdAt; }

  static create(input: {
    id: ChatId;
    noteId: string;
    userId: string;
    question: string;
    answer: string;
    tokensUsed: number;
    provider: AIProvider;
  }): ChatEntity {
    validateQuestion(input.question);
    return new ChatEntity({
      ...input,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: ChatProps): ChatEntity {
    return new ChatEntity(props);
  }

  belongsTo(userId: string): boolean {
    return this.#userId === userId;
  }

  toPublic(): ChatProps {
    return {
      id: this.#id,
      noteId: this.#noteId,
      userId: this.#userId,
      question: this.#question,
      answer: this.#answer,
      tokensUsed: this.#tokensUsed,
      provider: this.#provider,
      createdAt: this.#createdAt,
    };
  }

  toPersistence(): ChatProps {
    return this.toPublic();
  }
}
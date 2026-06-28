import { ValidationError } from "@/server/utils/errors";

// ─── Rules ────────────────────────────────────────────────────────────────────

export const FLASHCARD_RULES = {
  front: { minLength: 1, maxLength: 500 },
  back: { minLength: 1, maxLength: 1000 },
  count: { min: 1, max: 30 },
} as const;

export type FlashcardId = string;
export type FlashcardDifficulty = "easy" | "medium" | "hard";

export interface FlashcardProps {
  id: FlashcardId;
  noteId: string;
  userId: string;
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
  reviewCount: number;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFront(front: string): void {
  if (!front.trim()) {
    throw new ValidationError("Validation failed", { front: "Front is required" });
  }
  if (front.length > FLASHCARD_RULES.front.maxLength) {
    throw new ValidationError("Validation failed", {
      front: `Front cannot exceed ${FLASHCARD_RULES.front.maxLength} characters`,
    });
  }
}

function validateBack(back: string): void {
  if (!back.trim()) {
    throw new ValidationError("Validation failed", { back: "Back is required" });
  }
  if (back.length > FLASHCARD_RULES.back.maxLength) {
    throw new ValidationError("Validation failed", {
      back: `Back cannot exceed ${FLASHCARD_RULES.back.maxLength} characters`,
    });
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class FlashcardEntity {
  readonly #id: FlashcardId;
  readonly #noteId: string;
  readonly #userId: string;
  readonly #front: string;
  readonly #back: string;
  readonly #difficulty: FlashcardDifficulty;
  readonly #reviewCount: number;
  readonly #lastReviewedAt: Date | null;
  readonly #createdAt: Date;
  readonly #updatedAt: Date;

  private constructor(props: FlashcardProps) {
    this.#id = props.id;
    this.#noteId = props.noteId;
    this.#userId = props.userId;
    this.#front = props.front;
    this.#back = props.back;
    this.#difficulty = props.difficulty;
    this.#reviewCount = props.reviewCount;
    this.#lastReviewedAt = props.lastReviewedAt;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
  }

  get id(): FlashcardId { return this.#id; }
  get noteId(): string { return this.#noteId; }
  get userId(): string { return this.#userId; }
  get front(): string { return this.#front; }
  get back(): string { return this.#back; }
  get difficulty(): FlashcardDifficulty { return this.#difficulty; }
  get reviewCount(): number { return this.#reviewCount; }
  get lastReviewedAt(): Date | null { return this.#lastReviewedAt; }
  get createdAt(): Date { return this.#createdAt; }
  get updatedAt(): Date { return this.#updatedAt; }

  static create(input: {
    id: FlashcardId;
    noteId: string;
    userId: string;
    front: string;
    back: string;
    difficulty: FlashcardDifficulty;
  }): FlashcardEntity {
    validateFront(input.front);
    validateBack(input.back);
    return new FlashcardEntity({
      ...input,
      reviewCount: 0,
      lastReviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: FlashcardProps): FlashcardEntity {
    return new FlashcardEntity(props);
  }

  belongsTo(userId: string): boolean {
    return this.#userId === userId;
  }

  hasBeenReviewed(): boolean {
    return this.#reviewCount > 0;
  }

  toPublic(): FlashcardProps {
    return {
      id: this.#id,
      noteId: this.#noteId,
      userId: this.#userId,
      front: this.#front,
      back: this.#back,
      difficulty: this.#difficulty,
      reviewCount: this.#reviewCount,
      lastReviewedAt: this.#lastReviewedAt,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  toPersistence(): FlashcardProps {
    return this.toPublic();
  }
}
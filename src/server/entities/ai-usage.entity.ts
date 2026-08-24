import { ValidationError } from "@/server/utils/errors";

export const AI_USAGE_PROVIDERS = [
  "openai",
  "gemini",
] as const;

export type AIUsageProvider =
  (typeof AI_USAGE_PROVIDERS)[number];

export interface AIUsageProps {
  id: string;

  /**
   * Null is allowed for internal/system AI calls where
   * user context has not been propagated yet.
   */
  userId: string | null;
  noteId: string | null;

  provider: AIUsageProvider;
  model: string;
  usageLabel: string;

  success: boolean;

  tokensUsed: number;
  latencyMs: number;

  statusCode: number | null;
  quotaExceeded: boolean;

  createdAt: Date;
}

function validateNonNegative(
  field: string,
  value: number,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError("Validation failed", {
      [field]: `${field} must be a non-negative number`,
    });
  }
}

export class AIUsageEntity {
  readonly #props: AIUsageProps;

  private constructor(props: AIUsageProps) {
    this.#props = props;
  }

  static create(
    input: Omit<AIUsageProps, "createdAt"> & {
      createdAt?: Date;
    },
  ): AIUsageEntity {
    if (!input.id.trim()) {
      throw new ValidationError("Validation failed", {
        id: "AI usage id is required",
      });
    }

    if (!input.model.trim()) {
      throw new ValidationError("Validation failed", {
        model: "AI model is required",
      });
    }

    if (!input.usageLabel.trim()) {
      throw new ValidationError("Validation failed", {
        usageLabel: "AI usage label is required",
      });
    }

    validateNonNegative(
      "tokensUsed",
      input.tokensUsed,
    );

    validateNonNegative(
      "latencyMs",
      input.latencyMs,
    );

    if (
      input.statusCode !== null &&
      (
        !Number.isInteger(input.statusCode) ||
        input.statusCode < 100 ||
        input.statusCode > 599
      )
    ) {
      throw new ValidationError("Validation failed", {
        statusCode: "Invalid HTTP status code",
      });
    }

    return new AIUsageEntity({
      ...input,
      userId: input.userId?.trim() || null,
      noteId: input.noteId?.trim() || null,
      model: input.model.trim(),
      usageLabel: input.usageLabel.trim(),
      createdAt: input.createdAt ?? new Date(),
    });
  }

  static fromPersistence(
    props: AIUsageProps,
  ): AIUsageEntity {
    return new AIUsageEntity(props);
  }

  get id(): string {
    return this.#props.id;
  }

  get userId(): string | null {
    return this.#props.userId;
  }

  get noteId(): string | null {
    return this.#props.noteId;
  }

  get provider(): AIUsageProvider {
    return this.#props.provider;
  }

  get model(): string {
    return this.#props.model;
  }

  get usageLabel(): string {
    return this.#props.usageLabel;
  }

  get success(): boolean {
    return this.#props.success;
  }

  get tokensUsed(): number {
    return this.#props.tokensUsed;
  }

  get latencyMs(): number {
    return this.#props.latencyMs;
  }

  get statusCode(): number | null {
    return this.#props.statusCode;
  }

  get quotaExceeded(): boolean {
    return this.#props.quotaExceeded;
  }

  get createdAt(): Date {
    return this.#props.createdAt;
  }

  toPublic(): AIUsageProps {
    return {
      ...this.#props,
      createdAt: new Date(this.#props.createdAt),
    };
  }

  toPersistence(): AIUsageProps {
    return this.toPublic();
  }
}

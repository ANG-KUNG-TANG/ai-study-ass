import { ValidationError } from "@/server/utils/errors";

export interface UserAIPolicyProps {
  userId: string;
  enabled: boolean;
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserAIPolicyUpdate = Pick<
  UserAIPolicyProps,
  "enabled" | "dailyRequestLimit" | "dailyTokenLimit"
>;

function validateLimit(field: string, value: number | null): void {
  if (
    value !== null &&
    (!Number.isInteger(value) || value < 0 || value > 1_000_000_000)
  ) {
    throw new ValidationError("Validation failed", {
      [field]: `${field} must be null or an integer between 0 and 1000000000`,
    });
  }
}

export class UserAIPolicyEntity {
  readonly #props: UserAIPolicyProps;

  private constructor(props: UserAIPolicyProps) {
    this.#props = props;
  }

  static create(
    input: Omit<UserAIPolicyProps, "createdAt" | "updatedAt"> & {
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): UserAIPolicyEntity {
    if (!input.userId.trim() || !input.updatedBy.trim()) {
      throw new ValidationError("Validation failed", {
        userId: "User and administrator identifiers are required",
      });
    }

    validateLimit("dailyRequestLimit", input.dailyRequestLimit);
    validateLimit("dailyTokenLimit", input.dailyTokenLimit);

    const now = new Date();

    return new UserAIPolicyEntity({
      userId: input.userId.trim(),
      enabled: input.enabled,
      dailyRequestLimit: input.dailyRequestLimit,
      dailyTokenLimit: input.dailyTokenLimit,
      updatedBy: input.updatedBy.trim(),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
  }

  static fromPersistence(props: UserAIPolicyProps): UserAIPolicyEntity {
    return new UserAIPolicyEntity(props);
  }

  toPublic(): UserAIPolicyProps {
    return {
      ...this.#props,
      createdAt: new Date(this.#props.createdAt),
      updatedAt: new Date(this.#props.updatedAt),
    };
  }
}

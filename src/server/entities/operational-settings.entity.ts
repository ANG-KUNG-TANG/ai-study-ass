import { ValidationError } from "@/server/utils/errors";
import { MAX_FILE_SIZE_BYTES } from "@/server/utils/constants";

export const OPERATIONAL_SETTINGS_ID = "system";

export const ADMIN_FILE_TYPES = ["pdf", "docx"] as const;
export type AdminFileType = (typeof ADMIN_FILE_TYPES)[number];

export interface ProviderPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export interface OperationalSettingsProps {
  id: typeof OPERATIONAL_SETTINGS_ID;
  uploadsEnabled: boolean;
  aiGenerationEnabled: boolean;
  allowedFileTypes: AdminFileType[];
  maxUploadSizeBytes: number;
  auditRetentionDays: number;
  contentRetentionDays: number;
  pricing: {
    openai: ProviderPricing;
    gemini: ProviderPricing;
  };
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OperationalSettingsUpdate = Pick<
  OperationalSettingsProps,
  | "uploadsEnabled"
  | "aiGenerationEnabled"
  | "allowedFileTypes"
  | "maxUploadSizeBytes"
  | "auditRetentionDays"
  | "contentRetentionDays"
  | "pricing"
>;

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettingsUpdate = {
  uploadsEnabled: true,
  aiGenerationEnabled: true,
  allowedFileTypes: ["pdf", "docx"],
  maxUploadSizeBytes: MAX_FILE_SIZE_BYTES,
  auditRetentionDays: 365,
  contentRetentionDays: 0,
  pricing: {
    openai: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
    gemini: {
      inputPerMillionUsd: 0,
      outputPerMillionUsd: 0,
    },
  },
};

function validatePrice(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 10_000) {
    throw new ValidationError("Validation failed", {
      [field]: `${field} must be between 0 and 10000`,
    });
  }
}

export class OperationalSettingsEntity {
  readonly #props: OperationalSettingsProps;

  private constructor(props: OperationalSettingsProps) {
    this.#props = props;
  }

  static create(
    input: OperationalSettingsUpdate & {
      updatedBy?: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): OperationalSettingsEntity {
    const allowedFileTypes = [...new Set(input.allowedFileTypes)];

    if (allowedFileTypes.length === 0) {
      throw new ValidationError("Validation failed", {
        allowedFileTypes: "At least one upload file type must remain enabled",
      });
    }

    if (
      !Number.isInteger(input.maxUploadSizeBytes) ||
      input.maxUploadSizeBytes < 1024 ||
      input.maxUploadSizeBytes > MAX_FILE_SIZE_BYTES
    ) {
      throw new ValidationError("Validation failed", {
        maxUploadSizeBytes: `Upload size must be between 1KB and ${MAX_FILE_SIZE_BYTES} bytes`,
      });
    }

    if (
      !Number.isInteger(input.auditRetentionDays) ||
      input.auditRetentionDays < 30 ||
      input.auditRetentionDays > 3650
    ) {
      throw new ValidationError("Validation failed", {
        auditRetentionDays: "Audit retention must be between 30 and 3650 days",
      });
    }

    if (
      !Number.isInteger(input.contentRetentionDays) ||
      input.contentRetentionDays < 0 ||
      input.contentRetentionDays > 3650
    ) {
      throw new ValidationError("Validation failed", {
        contentRetentionDays: "Content retention must be 0 or between 1 and 3650 days",
      });
    }

    validatePrice(
      "pricing.openai.inputPerMillionUsd",
      input.pricing.openai.inputPerMillionUsd,
    );
    validatePrice(
      "pricing.openai.outputPerMillionUsd",
      input.pricing.openai.outputPerMillionUsd,
    );
    validatePrice(
      "pricing.gemini.inputPerMillionUsd",
      input.pricing.gemini.inputPerMillionUsd,
    );
    validatePrice(
      "pricing.gemini.outputPerMillionUsd",
      input.pricing.gemini.outputPerMillionUsd,
    );

    const now = new Date();

    return new OperationalSettingsEntity({
      id: OPERATIONAL_SETTINGS_ID,
      uploadsEnabled: input.uploadsEnabled,
      aiGenerationEnabled: input.aiGenerationEnabled,
      allowedFileTypes,
      maxUploadSizeBytes: input.maxUploadSizeBytes,
      auditRetentionDays: input.auditRetentionDays,
      contentRetentionDays: input.contentRetentionDays,
      pricing: {
        openai: { ...input.pricing.openai },
        gemini: { ...input.pricing.gemini },
      },
      updatedBy: input.updatedBy ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
  }

  static defaults(): OperationalSettingsEntity {
    return OperationalSettingsEntity.create(DEFAULT_OPERATIONAL_SETTINGS);
  }

  static fromPersistence(
    props: OperationalSettingsProps,
  ): OperationalSettingsEntity {
    return new OperationalSettingsEntity(props);
  }

  toPublic(): OperationalSettingsProps {
    return {
      ...this.#props,
      allowedFileTypes: [...this.#props.allowedFileTypes],
      pricing: {
        openai: { ...this.#props.pricing.openai },
        gemini: { ...this.#props.pricing.gemini },
      },
      createdAt: new Date(this.#props.createdAt),
      updatedAt: new Date(this.#props.updatedAt),
    };
  }
}

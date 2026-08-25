import type { AIProvider } from "@/server/config/ai_config";
import {
  OperationalSettingsEntity,
  type OperationalSettingsProps,
  type OperationalSettingsUpdate,
} from "@/server/entities/operational-settings.entity";
import * as settingsRepo from "@/server/repositories/operational-settings.repo";
import { AIError, ServiceUnavailableError } from "@/server/utils/errors";

const CACHE_TTL_MS = 15_000;

let cached:
  | {
      expiresAt: number;
      value: OperationalSettingsProps;
    }
  | undefined;

function cache(value: OperationalSettingsProps): OperationalSettingsProps {
  cached = {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return value;
}

export async function getOperationalSettings(
  force = false,
): Promise<OperationalSettingsProps> {
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const stored = await settingsRepo.find();
  return cache((stored ?? OperationalSettingsEntity.defaults()).toPublic());
}

export async function updateOperationalSettings(
  adminId: string,
  update: OperationalSettingsUpdate,
): Promise<OperationalSettingsProps> {
  const current = await getOperationalSettings(true);
  const entity = OperationalSettingsEntity.create({
    ...update,
    updatedBy: adminId,
    createdAt: current.createdAt,
  });
  const saved = await settingsRepo.save(entity);

  return cache(saved.toPublic());
}

export async function assertUploadsEnabled(): Promise<OperationalSettingsProps> {
  const settings = await getOperationalSettings();

  if (!settings.uploadsEnabled) {
    throw new ServiceUnavailableError(
      "Document uploads are temporarily disabled by an administrator",
    );
  }

  return settings;
}

export async function assertAIGenerationEnabled(): Promise<OperationalSettingsProps> {
  const settings = await getOperationalSettings();

  if (!settings.aiGenerationEnabled) {
    throw new AIError(
      "AI provider generation is temporarily disabled. Symbolic study features remain available.",
    );
  }

  return settings;
}

export function estimateAICost(
  settings: OperationalSettingsProps,
  provider: AIProvider,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = settings.pricing[provider];
  const cost =
    (Math.max(0, inputTokens) / 1_000_000) * pricing.inputPerMillionUsd +
    (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPerMillionUsd;

  return Number(cost.toFixed(8));
}

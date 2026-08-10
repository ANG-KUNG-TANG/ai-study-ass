import { TelegramIntegrationModel } from "@/server/models/TelegramIntegration.model";

import { TelegramLinkTokenModel } from "@/server/models/TelegramLinkToken.model";

// ─── Integration ──────────────────────────────────────────────────────────────

export async function findByUserId(userId: string) {
  return TelegramIntegrationModel.findOne({ userId }).lean();
}

export async function findByTelegramUserId(telegramUserId: number) {
  return TelegramIntegrationModel.findOne({ telegramUserId }).lean();
}

export async function createIntegration(input: {
  userId: string;
  telegramUserId: number;
  telegramChatId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
}) {
  return TelegramIntegrationModel.create({
    ...input,
    linkedAt: new Date(),
    lastActiveAt: new Date(),
  });
}

export async function updateLastActive(telegramUserId: number) {
  return TelegramIntegrationModel.updateOne(
    {
      telegramUserId,
    },
    {
      $set: {
        lastActiveAt: new Date(),
      },
    },
  );
}

export async function deleteByUserId(userId: string) {
  return TelegramIntegrationModel.deleteOne({
    userId,
  });
}

// ─── Link Token ───────────────────────────────────────────────────────────────

export async function deleteTokensForUser(userId: string) {
  return TelegramLinkTokenModel.deleteMany({
    userId,
  });
}

export async function createLinkToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return TelegramLinkTokenModel.create(input);
}

/**
 * Atomic one-time token consumption.
 *
 * A token cannot be successfully used twice.
 */
export async function consumeLinkToken(tokenHash: string) {
  return TelegramLinkTokenModel.findOneAndDelete({
    tokenHash,
    expiresAt: {
      $gt: new Date(),
    },
  }).lean();
}

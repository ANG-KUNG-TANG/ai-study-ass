import { createHash, randomBytes } from "crypto";

import {
  ConflictError,
  BadRequestError,
  NotFoundError,
} from "@/server/utils/errors";

import * as telegramRepo from "@/server/repositories/telegramIntegration.repo";

const LINK_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Generate Link ────────────────────────────────────────────────────────────

export async function generateTelegramLink(userId: string) {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;

  if (!botUsername) {
    throw new Error("TELEGRAM_BOT_USERNAME is not configured");
  }

  const existing = await telegramRepo.findByUserId(userId);

  if (existing) {
    throw new ConflictError("Telegram is already connected to this account");
  }

  // Remove previously generated unused tokens
  await telegramRepo.deleteTokensForUser(userId);

  const rawToken = randomBytes(24).toString("base64url");

  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

  await telegramRepo.createLinkToken({
    userId,
    tokenHash,
    expiresAt,
  });

  const cleanUsername = botUsername.replace(/^@/, "");

  return {
    url: `https://t.me/${cleanUsername}` + `?start=${rawToken}`,

    expiresAt,
  };
}

// ─── Consume Link ─────────────────────────────────────────────────────────────

export async function linkTelegramAccount(input: {
  token: string;

  telegramUserId: number;
  telegramChatId: number;

  telegramUsername?: string;
  telegramFirstName?: string;
}) {
  if (!input.token.trim()) {
    throw new BadRequestError("Telegram linking token is required");
  }

  const tokenHash = hashToken(input.token);

  const linkToken = await telegramRepo.consumeLinkToken(tokenHash);

  if (!linkToken) {
    throw new BadRequestError("Telegram linking token is invalid or expired");
  }

  const telegramExisting = await telegramRepo.findByTelegramUserId(
    input.telegramUserId,
  );

  if (telegramExisting && telegramExisting.userId !== linkToken.userId) {
    throw new ConflictError(
      "This Telegram account is already linked to another account",
    );
  }

  const userExisting = await telegramRepo.findByUserId(linkToken.userId);

  if (userExisting) {
    throw new ConflictError("This account already has a Telegram connection");
  }

  const integration = await telegramRepo.createIntegration({
    userId: linkToken.userId,

    telegramUserId: input.telegramUserId,

    telegramChatId: input.telegramChatId,

    telegramUsername: input.telegramUsername,

    telegramFirstName: input.telegramFirstName,
  });

  return integration;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export async function getTelegramStatus(userId: string) {
  const integration = await telegramRepo.findByUserId(userId);

  if (!integration) {
    return {
      connected: false,
    };
  }

  return {
    connected: true,

    username: integration.telegramUsername,

    firstName: integration.telegramFirstName,

    linkedAt: integration.linkedAt,
  };
}

// ─── Unlink ───────────────────────────────────────────────────────────────────

export async function unlinkTelegram(userId: string) {
  const integration = await telegramRepo.findByUserId(userId);

  if (!integration) {
    throw new NotFoundError("Telegram connection not found");
  }

  await telegramRepo.deleteByUserId(userId);

  return {
    disconnected: true,
  };
}

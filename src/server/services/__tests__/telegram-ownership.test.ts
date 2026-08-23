jest.mock("@/server/repositories/telegramIntegration.repo");

import { createHash } from "crypto";

import * as telegramRepo from "@/server/repositories/telegramIntegration.repo";
import {
  generateTelegramLink,
  getTelegramStatus,
  linkTelegramAccount,
  unlinkTelegram,
} from "@/server/services/telegramLink.service";

describe("telegram integration ownership", () => {
  const originalBotUsername = process.env.TELEGRAM_BOT_USERNAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_USERNAME = "aistudyassbot";
  });

  afterAll(() => {
    if (originalBotUsername === undefined) {
      delete process.env.TELEGRAM_BOT_USERNAME;
    } else {
      process.env.TELEGRAM_BOT_USERNAME = originalBotUsername;
    }
  });

  it("creates a one-time link token bound to the authenticated web user", async () => {
    jest.mocked(telegramRepo.findByUserId).mockResolvedValue(null);
    jest.mocked(telegramRepo.deleteTokensForUser).mockResolvedValue({} as never);
    jest.mocked(telegramRepo.createLinkToken).mockResolvedValue({} as never);

    const result = await generateTelegramLink("user-1");

    expect(telegramRepo.findByUserId).toHaveBeenCalledWith("user-1");
    expect(telegramRepo.deleteTokensForUser).toHaveBeenCalledWith("user-1");

    const url = new URL(result.url);
    const rawToken = url.searchParams.get("start");

    expect(rawToken).toBeTruthy();

    const expectedHash = createHash("sha256")
      .update(rawToken!)
      .digest("hex");

    expect(telegramRepo.createLinkToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tokenHash: expectedHash,
        expiresAt: expect.any(Date),
      }),
    );

    expect(
      jest.mocked(telegramRepo.createLinkToken).mock.calls[0]?.[0].tokenHash,
    ).not.toBe(rawToken);
  });

  it("uses the consumed token's userId as the web-account owner", async () => {
    jest.mocked(telegramRepo.consumeLinkToken).mockResolvedValue({
      userId: "user-from-token",
    } as never);
    jest.mocked(telegramRepo.findByTelegramUserId).mockResolvedValue(null);
    jest.mocked(telegramRepo.findByUserId).mockResolvedValue(null);
    jest.mocked(telegramRepo.createIntegration).mockResolvedValue({
      userId: "user-from-token",
    } as never);

    await linkTelegramAccount({
      token: "raw-link-token",
      telegramUserId: 111,
      telegramChatId: 222,
      telegramUsername: "telegram-user",
      telegramFirstName: "Test",
    });

    expect(telegramRepo.createIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-from-token",
        telegramUserId: 111,
        telegramChatId: 222,
      }),
    );
  });

  it("rejects a Telegram identity already owned by another web account", async () => {
    jest.mocked(telegramRepo.consumeLinkToken).mockResolvedValue({
      userId: "user-1",
    } as never);

    jest.mocked(telegramRepo.findByTelegramUserId).mockResolvedValue({
      userId: "user-2",
      telegramUserId: 111,
    } as never);

    await expect(
      linkTelegramAccount({
        token: "raw-link-token",
        telegramUserId: 111,
        telegramChatId: 222,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });

    expect(telegramRepo.createIntegration).not.toHaveBeenCalled();
  });

  it("reads Telegram status only by authenticated web userId", async () => {
    jest.mocked(telegramRepo.findByUserId).mockResolvedValue({
      userId: "user-1",
      telegramUsername: "owner",
      telegramFirstName: "Owner",
      linkedAt: new Date("2026-08-23T00:00:00.000Z"),
    } as never);

    await getTelegramStatus("user-1");

    expect(telegramRepo.findByUserId).toHaveBeenCalledWith("user-1");
    expect(telegramRepo.findByTelegramUserId).not.toHaveBeenCalled();
  });

  it("disconnects only the authenticated web user's integration", async () => {
    jest.mocked(telegramRepo.findByUserId).mockResolvedValue({
      userId: "user-1",
    } as never);
    jest.mocked(telegramRepo.deleteByUserId).mockResolvedValue({} as never);

    await expect(
      unlinkTelegram("user-1"),
    ).resolves.toEqual({
      disconnected: true,
    });

    expect(telegramRepo.findByUserId).toHaveBeenCalledWith("user-1");
    expect(telegramRepo.deleteByUserId).toHaveBeenCalledWith("user-1");
  });

  it("does not delete any integration when the authenticated user has none", async () => {
    jest.mocked(telegramRepo.findByUserId).mockResolvedValue(null);

    await expect(
      unlinkTelegram("user-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(telegramRepo.deleteByUserId).not.toHaveBeenCalled();
  });
});

jest.mock("@/server/integrations/telegram/telegram.client");
jest.mock("@/server/repositories/telegramIntegration.repo");
jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/services/telegramLink.service");
jest.mock("@/server/services/upload.service");
jest.mock("@/server/services/note.service");

import { sendMessage } from "@/server/integrations/telegram/telegram.client";
import * as telegramIntegrationRepo from "@/server/repositories/telegramIntegration.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { processUpdate } from "@/server/services/telegram.service";

import type { TelegramUpdate } from "@/server/integrations/telegram/telegram.types";

const MY_FILES_UPDATE: TelegramUpdate = {
  update_id: 1,
  message: {
    message_id: 10,
    date: 1_786_000_000,
    chat: {
      id: 456,
      type: "private",
    },
    from: {
      id: 123,
      is_bot: false,
      first_name: "Anri",
      username: "anrikung",
    },
    text: "/myfiles",
  },
};

describe("telegram.service /myfiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.APP_PUBLIC_URL = "https://study.example.com";

    jest
      .mocked(telegramIntegrationRepo.updateLastActive)
      .mockResolvedValue(undefined as never);

    jest.mocked(sendMessage).mockResolvedValue(undefined);
  });

  it("shows the five newest documents for a linked user", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue({
        userId: "user-1",
      } as never);

    jest.mocked(noteRepo.findManyByUser).mockResolvedValue({
      data: [
        {
          id: "note-1",
          title: "Software Defect Prediction",
          fileType: "pdf",
          createdAt: new Date("2026-08-10T00:00:00Z"),
        },
        {
          id: "note-2",
          title: "Networking Chapter 5",
          fileType: "pdf",
          createdAt: new Date("2026-08-09T00:00:00Z"),
        },
      ],
      total: 2,
      page: 1,
      limit: 5,
    } as never);

    await processUpdate(MY_FILES_UPDATE);

    expect(telegramIntegrationRepo.findByTelegramUserId).toHaveBeenCalledWith(
      123,
    );

    expect(telegramIntegrationRepo.updateLastActive).toHaveBeenCalledWith(123);

    expect(noteRepo.findManyByUser).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 5,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);

    const [chatId, text, options] = jest.mocked(sendMessage).mock.calls[0];

    expect(chatId).toBe(456);

    expect(text).toContain("📚 Your Recent Files");
    expect(text).toContain("Software Defect Prediction");
    expect(text).toContain("Networking Chapter 5");
    expect(text).toContain("2 documents total.");

    expect(options?.buttons).toEqual(
      expect.arrayContaining([
        [
          {
            text: "📖 Software Defect Prediction",
            url: "https://study.example.com/student/notes/note-1/summary",
          },
        ],
        [
          {
            text: "📖 Networking Chapter 5",
            url: "https://study.example.com/student/notes/note-2/summary",
          },
        ],
      ]),
    );
  });

  it("asks an unlinked Telegram user to connect first", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue(null);

    await processUpdate(MY_FILES_UPDATE);

    expect(noteRepo.findManyByUser).not.toHaveBeenCalled();

    expect(sendMessage).toHaveBeenCalledWith(
      456,
      expect.stringContaining("Telegram is not connected"),
      expect.objectContaining({
        buttons: expect.any(Array),
      }),
    );
  });

  it("shows an empty-state message when the user has no documents", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue({
        userId: "user-1",
      } as never);

    jest.mocked(noteRepo.findManyByUser).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 5,
    } as never);

    await processUpdate(MY_FILES_UPDATE);

    expect(sendMessage).toHaveBeenCalledWith(
      456,
      expect.stringContaining("You have not uploaded any documents yet."),
      expect.objectContaining({
        buttons: expect.any(Array),
      }),
    );
  });
});

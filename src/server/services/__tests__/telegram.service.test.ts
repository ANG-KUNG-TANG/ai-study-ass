jest.mock("@/server/integrations/telegram/telegram.client");
jest.mock("@/server/repositories/telegramIntegration.repo");
jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/services/telegramLink.service");
jest.mock("@/server/services/upload.service");
jest.mock("@/server/services/note.service");
jest.mock("@/server/repositories/study-generation.repo");

import { sendMessage } from "@/server/integrations/telegram/telegram.client";
import * as telegramIntegrationRepo from "@/server/repositories/telegramIntegration.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";

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

const STATUS_UPDATE: TelegramUpdate = {
  update_id: 2,
  message: {
    message_id: 11,
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
    text: "/status",
  },
};

// ─── Shared test setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();

  process.env.APP_PUBLIC_URL = "https://study.example.com";

  jest
    .mocked(telegramIntegrationRepo.updateLastActive)
    .mockResolvedValue(undefined as never);

  jest.mocked(sendMessage).mockResolvedValue(undefined);
});

// ─── /myfiles ─────────────────────────────────────────────────────────────────

describe("telegram.service /myfiles", () => {
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

    expect(
      telegramIntegrationRepo.findByTelegramUserId,
    ).toHaveBeenCalledWith(123);

    expect(
      telegramIntegrationRepo.updateLastActive,
    ).toHaveBeenCalledWith(123);

    expect(noteRepo.findManyByUser).toHaveBeenCalledWith(
      "user-1",
      {
        page: 1,
        limit: 5,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);

    const [chatId, text, options] =
      jest.mocked(sendMessage).mock.calls[0];

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
            url:
              "https://study.example.com/student/notes/note-1/summary",
          },
        ],
        [
          {
            text: "📖 Networking Chapter 5",
            url:
              "https://study.example.com/student/notes/note-2/summary",
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
      expect.stringContaining(
        "You have not uploaded any documents yet.",
      ),
      expect.objectContaining({
        buttons: expect.any(Array),
      }),
    );
  });
});

// ─── /status ──────────────────────────────────────────────────────────────────

describe("telegram.service /status", () => {
  it("shows complete generation status for the newest document", async () => {
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
        },
      ],
      total: 1,
      page: 1,
      limit: 1,
    } as never);

    jest.mocked(generationRepo.findByNoteId).mockResolvedValue({
      noteId: "note-1",
      userId: "user-1",
      stage: "complete",

      features: {
        summary: {
          status: "ready",
        },

        quiz: {
          status: "ready",
        },

        flashcards: {
          status: "ready",
        },

        chatKnowledge: {
          status: "ready",
        },
      },

      startedAt: new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await processUpdate(STATUS_UPDATE);

    expect(noteRepo.findManyByUser).toHaveBeenCalledWith(
      "user-1",
      {
        page: 1,
        limit: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    );

    expect(
      generationRepo.findByNoteId,
    ).toHaveBeenCalledWith("note-1");

    expect(sendMessage).toHaveBeenCalledTimes(1);

    const [chatId, text] =
      jest.mocked(sendMessage).mock.calls[0];

    expect(chatId).toBe(456);

    expect(text).toContain("📊 Study Generation Status");
    expect(text).toContain("Software Defect Prediction");
    expect(text).toContain("✅ Intelligence");
    expect(text).toContain("✅ Summary");
    expect(text).toContain("✅ Knowledge");
    expect(text).toContain("✅ Quiz");
    expect(text).toContain("✅ Flashcards");
    expect(text).toContain("Overall: Complete");
  });

  it("shows processing status while generation is running", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue({
        userId: "user-1",
      } as never);

    jest.mocked(noteRepo.findManyByUser).mockResolvedValue({
      data: [
        {
          id: "note-1",
          title: "Networking Chapter 5",
        },
      ],
      total: 1,
      page: 1,
      limit: 1,
    } as never);

    jest.mocked(generationRepo.findByNoteId).mockResolvedValue({
      noteId: "note-1",
      userId: "user-1",
      stage: "generating",

      features: {
        summary: {
          status: "ready",
        },

        quiz: {
          status: "generating",
        },

        flashcards: {
          status: "pending",
        },

        chatKnowledge: {
          status: "ready",
        },
      },

      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await processUpdate(STATUS_UPDATE);

    expect(sendMessage).toHaveBeenCalledTimes(1);

    const [, text] =
      jest.mocked(sendMessage).mock.calls[0];

    expect(text).toContain("Networking Chapter 5");
    expect(text).toContain("✅ Summary");
    expect(text).toContain("🔄 Quiz");
    expect(text).toContain("⏳ Flashcards");

    expect(text).toContain(
      "Overall: Generating study materials",
    );
  });

  it("shows waiting state when no generation record exists", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue({
        userId: "user-1",
      } as never);

    jest.mocked(noteRepo.findManyByUser).mockResolvedValue({
      data: [
        {
          id: "note-1",
          title: "Research Paper",
        },
      ],
      total: 1,
      page: 1,
      limit: 1,
    } as never);

    jest
      .mocked(generationRepo.findByNoteId)
      .mockResolvedValue(null);

    await processUpdate(STATUS_UPDATE);

    expect(
      generationRepo.findByNoteId,
    ).toHaveBeenCalledWith("note-1");

    expect(sendMessage).toHaveBeenCalledWith(
      456,
      expect.stringContaining(
        "Generation is waiting to start",
      ),
      expect.any(Object),
    );
  });

  it("shows no-document message when user has no notes", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue({
        userId: "user-1",
      } as never);

    jest.mocked(noteRepo.findManyByUser).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 1,
    } as never);

    await processUpdate(STATUS_UPDATE);

    expect(
      generationRepo.findByNoteId,
    ).not.toHaveBeenCalled();

    expect(sendMessage).toHaveBeenCalledWith(
      456,
      expect.stringContaining(
        "You do not have any uploaded documents yet.",
      ),
      expect.any(Object),
    );
  });

  it("requires a linked account for /status", async () => {
    jest
      .mocked(telegramIntegrationRepo.findByTelegramUserId)
      .mockResolvedValue(null);

    await processUpdate(STATUS_UPDATE);

    expect(
      noteRepo.findManyByUser,
    ).not.toHaveBeenCalled();

    expect(
      generationRepo.findByNoteId,
    ).not.toHaveBeenCalled();

    expect(sendMessage).toHaveBeenCalledWith(
      456,
      expect.stringContaining(
        "Telegram is not connected",
      ),
      expect.any(Object),
    );
  });
});
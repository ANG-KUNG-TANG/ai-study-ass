jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/services/intelligence.service");
jest.mock("@/server/services/knowledge.service");
jest.mock("@/server/repositories/chat.repo");
jest.mock("@/server/services/ai.service");

import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as knowledgeService from "@/server/services/knowledge.service";
import * as chatRepo from "@/server/repositories/chat.repo";
import {
  getChatHistory,
  clearChatHistory,
} from "@/server/services/chat/chat.service";
import {
  getIntelligenceStatus,
} from "@/server/controller/intelligence.controller";
import {
  getKnowledgeByNote,
  deleteKnowledgeByNote,
} from "@/server/controller/knowledge.controller";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";

const auth: AuthContext = {
  userId: "user-1",
  email: "user@example.com",
  role: "user",
};

const context: RouteContext = {
  params: Promise.resolve({
    id: "note-1",
  }),
};

describe("chat / intelligence ownership scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a user-scoped note lookup before reading chat history", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue({
      id: "note-1",
    } as never);
    jest.mocked(chatRepo.findByNoteIdAndUserId).mockResolvedValue([]);

    await expect(
      getChatHistory("note-1", "user-1"),
    ).resolves.toEqual([]);

    expect(noteRepo.findByIdAndUserId).toHaveBeenCalledWith(
      "note-1",
      "user-1",
    );
  });

  it("does not clear chat history for an inaccessible note", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      clearChatHistory("foreign-note", "user-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(
      chatRepo.deleteByNoteIdAndUserId,
    ).not.toHaveBeenCalled();
  });

  it("does not expose intelligence status for an inaccessible note", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      getIntelligenceStatus(
        new Request("http://localhost"),
        context,
        auth,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(
      intelligenceService.getStatus,
    ).not.toHaveBeenCalled();
  });

  it("does not expose knowledge for an inaccessible note", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      getKnowledgeByNote(
        new Request("http://localhost"),
        context,
        auth,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(
      knowledgeService.getKnowledge,
    ).not.toHaveBeenCalled();
  });

  it("does not delete knowledge for an inaccessible note", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      deleteKnowledgeByNote(
        new Request("http://localhost"),
        context,
        auth,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(
      knowledgeService.deleteKnowledge,
    ).not.toHaveBeenCalled();
  });
});

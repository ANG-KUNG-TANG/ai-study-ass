jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/repositories/study-generation.repo");
jest.mock("@/server/repositories/flashcard.repo");
jest.mock("@/server/repositories/quiz.repo");
jest.mock("@/server/services/summary/summary.service");
jest.mock("@/server/services/auditLog.service");

import fs from "fs";
import path from "path";

import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import * as quizRepo from "@/server/repositories/quiz.repo";
import * as summaryService from "@/server/services/summary/summary.service";

import {
  getGenerationStatus,
} from "@/server/services/study-material-generation.service";
import {
  getFlashcardsByNote,
} from "@/server/services/flashcard.service";
import {
  generateQuizWithMetadata,
} from "@/server/services/quiz/quiz.service";
import {
  postSummary,
} from "@/server/controller/summary.controller";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";

const auth: AuthContext = {
  userId: "user-a",
  email: "user-a@example.com",
  role: "user",
};

const emptyContext: RouteContext = {
  params: Promise.resolve({}),
};

describe("IDOR regression invariants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);
  });

  it("does not reveal or initialise generation status for a foreign note", async () => {
    await expect(
      getGenerationStatus("user-b-note", "user-a"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Note not found",
    });

    expect(generationRepo.findByNoteId).not.toHaveBeenCalled();
    expect(generationRepo.initialise).not.toHaveBeenCalled();
  });

  it("does not list flashcards for a foreign note", async () => {
    await expect(
      getFlashcardsByNote("user-b-note", "user-a"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Note not found",
    });

    expect(flashcardRepo.findByNoteAndUserId).not.toHaveBeenCalled();
    expect(flashcardRepo.findManyByNoteId).not.toHaveBeenCalled();
  });

  it("does not generate a quiz for a foreign note", async () => {
    await expect(
      generateQuizWithMetadata(
        "user-b-note",
        "user-a",
        {},
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Note not found",
    });

    expect(quizRepo.findLatestByNote).not.toHaveBeenCalled();
  });

  it("does not generate a summary for a foreign note", async () => {
    const request = new Request(
      "http://localhost/api/summary",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noteId: "user-b-note",
        }),
      },
    );

    await expect(
      postSummary(
        request,
        emptyContext,
        auth,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Note not found",
    });

    expect(summaryService.generateSummary).not.toHaveBeenCalled();
  });

  it("keeps the legacy intelligence-status alias behind withAuth", () => {
    const routePath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "notes",
      "[id]",
      "intelligence",
      "status",
      "route.ts",
    );

    const source = fs.readFileSync(routePath, "utf8");

    expect(source).toMatch(
      /withAuth\s*\(\s*getIntelligenceStatus\s*\)/,
    );
  });
});

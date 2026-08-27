jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/repositories/study-generation.repo");
jest.mock("@/server/services/intelligence.service");
jest.mock("@/server/services/summary/summary.service");
jest.mock("@/server/services/quiz/quiz.service");
jest.mock("@/server/services/flashcard.service");
jest.mock("@/server/services/chat/chat.service");

import * as noteRepo from "@/server/repositories/note.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as summaryService from "@/server/services/summary/summary.service";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import { generateStudyMaterials } from "@/server/services/study-material-generation.service";

const feature = (
  status: "ready" | "failed",
) => ({
  status,
  source: status === "failed" ? null : "symbolic",
  confidence: status === "failed" ? null : 0.8,
  aiFallbackUsed: false,
  itemCount: status === "failed" ? null : 1,
  error: status === "failed" ? "failed" : null,
  updatedAt: new Date(),
});

describe("study-material-generation.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue({
      id: "note-1",
      userId: "user-1",
      content: "Document content",
      fileName: "paper.pdf",
      fileType: "pdf",
      fileSize: 100,
      belongsTo: (userId: string) => userId === "user-1",
    } as never);

    jest.mocked(generationRepo.initialise).mockResolvedValue(
      {} as never,
    );
    jest.mocked(generationRepo.updateStage).mockResolvedValue(undefined);
    jest.mocked(generationRepo.updateFeature).mockResolvedValue(undefined);

    jest.mocked(
      intelligenceService.toRawDocument,
    ).mockReturnValue({} as never);
    jest.mocked(
      intelligenceService.runAndPersistPipeline,
    ).mockResolvedValue({} as never);
    jest.mocked(
      intelligenceService.getOrRunPipeline,
    ).mockResolvedValue({} as never);

    jest.mocked(
      summaryService.generateSummary,
    ).mockResolvedValue({
      summary: "Summary",
      mode: "comprehensive",
      keyPoints: ["Point"],
      importantConcepts: ["Concept"],
      cached: false,
      source: "symbolic",
      confidence: 0.8,
      aiFallbackUsed: false,
      status: "ready",
      itemCount: 1,
      tokensUsed: 0,
    });

    jest.mocked(
      quizService.generateQuizWithMetadata,
    ).mockResolvedValue({
      quiz: {} as never,
      metadata: {
        source: "symbolic",
        confidence: 0.8,
        aiFallbackUsed: false,
        status: "ready",
        itemCount: 5,
      },
    });

    jest.mocked(
      flashcardService.generateFlashcardsWithMetadata,
    ).mockResolvedValue({
      flashcards: [],
      metadata: {
        source: "symbolic",
        confidence: 0.8,
        aiFallbackUsed: false,
        status: "ready",
        itemCount: 8,
      },
    });

    jest.mocked(
      chatService.prepareChatKnowledge,
    ).mockResolvedValue({
      source: "symbolic",
      confidence: 0.8,
      aiFallbackUsed: false,
      status: "ready",
      itemCount: 4,
    });
  });

  it("runs all four features after intelligence", async () => {
    jest.mocked(generationRepo.findByNoteId)
      .mockResolvedValueOnce({
        noteId: "note-1",
        userId: "user-1",
        stage: "generating",
        features: {
          summary: feature("ready"),
          quiz: feature("ready"),
          flashcards: feature("ready"),
          chatKnowledge: feature("ready"),
        },
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      .mockResolvedValueOnce({
        noteId: "note-1",
        userId: "user-1",
        stage: "complete",
        features: {
          summary: feature("ready"),
          quiz: feature("ready"),
          flashcards: feature("ready"),
          chatKnowledge: feature("ready"),
        },
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

    const result = await generateStudyMaterials({
      noteId: "note-1",
      userId: "user-1",
    });

    expect(result.stage).toBe("complete");
    expect(
      summaryService.generateSummary,
    ).toHaveBeenCalled();
    expect(
      quizService.generateQuizWithMetadata,
    ).toHaveBeenCalled();
    expect(
      flashcardService.generateFlashcardsWithMetadata,
    ).toHaveBeenCalled();
    expect(
      chatService.prepareChatKnowledge,
    ).toHaveBeenCalled();
  });

  it("continues when one feature fails", async () => {
    jest.mocked(
      quizService.generateQuizWithMetadata,
    ).mockRejectedValue(
      new Error("quiz failed"),
    );

    jest.mocked(generationRepo.findByNoteId)
      .mockResolvedValueOnce({
        noteId: "note-1",
        userId: "user-1",
        stage: "generating",
        features: {
          summary: feature("ready"),
          quiz: feature("failed"),
          flashcards: feature("ready"),
          chatKnowledge: feature("ready"),
        },
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      .mockResolvedValueOnce({
        noteId: "note-1",
        userId: "user-1",
        stage: "partial",
        features: {
          summary: feature("ready"),
          quiz: feature("failed"),
          flashcards: feature("ready"),
          chatKnowledge: feature("ready"),
        },
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

    const result = await generateStudyMaterials({
      noteId: "note-1",
      userId: "user-1",
    });

    expect(result.stage).toBe("partial");
    expect(
      flashcardService.generateFlashcardsWithMetadata,
    ).toHaveBeenCalled();
    expect(
      chatService.prepareChatKnowledge,
    ).toHaveBeenCalled();
  });
});

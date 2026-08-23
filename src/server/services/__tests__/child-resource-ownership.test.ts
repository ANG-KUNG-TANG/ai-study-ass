jest.mock("@/server/repositories/quiz.repo");
jest.mock("@/server/repositories/flashcard.repo");

import * as quizRepo from "@/server/repositories/quiz.repo";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import {
  deleteQuiz,
  getQuiz,
} from "@/server/services/quiz/quiz.service";
import { updateReview } from "@/server/services/flashcard.service";

describe("child resource ownership scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads quizzes using quizId and authenticated userId", async () => {
    const quiz = {} as never;
    jest.mocked(quizRepo.findByIdAndUserId).mockResolvedValue(quiz);

    await expect(
      getQuiz("quiz-1", "user-1"),
    ).resolves.toBe(quiz);

    expect(quizRepo.findByIdAndUserId).toHaveBeenCalledWith(
      "quiz-1",
      "user-1",
    );
  });

  it("returns NOT_FOUND for an inaccessible quiz", async () => {
    jest.mocked(quizRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      getQuiz("foreign-quiz", "user-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("deletes a quiz with an owner-scoped mutation", async () => {
    jest.mocked(quizRepo.deleteByIdAndUserId).mockResolvedValue(true);

    await deleteQuiz("quiz-1", "user-1");

    expect(quizRepo.deleteByIdAndUserId).toHaveBeenCalledWith(
      "quiz-1",
      "user-1",
    );
    expect(quizRepo.deleteById).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when owner-scoped quiz deletion matches nothing", async () => {
    jest.mocked(quizRepo.deleteByIdAndUserId).mockResolvedValue(false);

    await expect(
      deleteQuiz("foreign-quiz", "user-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("updates flashcard review using an owner-scoped mutation", async () => {
    const flashcard = {
      toPublic: jest.fn().mockReturnValue({
        id: "card-1",
        difficulty: "hard",
      }),
    } as never;

    jest.mocked(
      flashcardRepo.updateReviewForUser,
    ).mockResolvedValue(flashcard);

    await expect(
      updateReview("card-1", "user-1", "hard"),
    ).resolves.toEqual({
      id: "card-1",
      difficulty: "hard",
    });

    expect(
      flashcardRepo.updateReviewForUser,
    ).toHaveBeenCalledWith(
      "card-1",
      "user-1",
      "hard",
    );
  });

  it("returns NOT_FOUND for an inaccessible flashcard review", async () => {
    jest.mocked(
      flashcardRepo.updateReviewForUser,
    ).mockResolvedValue(null);

    await expect(
      updateReview("foreign-card", "user-1", "easy"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });
});

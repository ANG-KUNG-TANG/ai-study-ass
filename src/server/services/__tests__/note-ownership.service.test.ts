jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/services/quiz/quiz.service");
jest.mock("@/server/services/flashcard.service");
jest.mock("@/server/services/chat/chat.service");
jest.mock("@/server/services/intelligence.service");
jest.mock("@/server/services/study-material-generation.service");
jest.mock("@/server/queues/study-generation.queue");

import * as noteRepo from "@/server/repositories/note.repo";
import * as quizService from "@/server/services/quiz/quiz.service";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as generationService from "@/server/services/study-material-generation.service";
import {
  deleteNote,
  getGeneratedNotes,
  getNoteById,
  getNoteContent,
  updateNoteSummary,
} from "@/server/services/note.service";

function ownedNote() {
  return {
    id: "note-1",
    userId: "user-1",
    title: "Security Notes",
    content: "Private study content",
    summary: "Private summary",
    updateSummary: jest.fn(),
    toPublic: jest.fn().mockReturnValue({
      id: "note-1",
      title: "Security Notes",
    }),
  } as never;
}

describe("note ownership scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads a note using both noteId and authenticated userId", async () => {
    const note = ownedNote();
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(note);

    await expect(
      getNoteById("note-1", "user-1"),
    ).resolves.toEqual({
      id: "note-1",
      title: "Security Notes",
    });

    expect(noteRepo.findByIdAndUserId).toHaveBeenCalledWith(
      "note-1",
      "user-1",
    );
    expect(noteRepo.findByIdOrThrow).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the scoped lookup cannot see the note", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      getNoteById("foreign-note", "user-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Note not found",
    });
  });

  it("does not delete associated data when ownership lookup fails", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      deleteNote("foreign-note", "user-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(noteRepo.deleteById).not.toHaveBeenCalled();
    expect(quizService.deleteForNote).not.toHaveBeenCalled();
    expect(flashcardService.deleteForNote).not.toHaveBeenCalled();
    expect(chatService.deleteForNote).not.toHaveBeenCalled();
    expect(intelligenceService.deleteForNote).not.toHaveBeenCalled();
    expect(generationService.deleteForNote).not.toHaveBeenCalled();
  });

  it("uses the scoped ownership lookup for note content and generated notes", async () => {
    const note = ownedNote();
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(note);

    await expect(
      getNoteContent("note-1", "user-1"),
    ).resolves.toEqual({
      content: "Private study content",
      title: "Security Notes",
    });

    await expect(
      getGeneratedNotes("note-1", "user-1"),
    ).resolves.toEqual({
      summary: "Private summary",
      title: "Security Notes",
    });

    expect(noteRepo.findByIdAndUserId).toHaveBeenCalledTimes(2);
  });

  it("does not update a summary for an inaccessible note", async () => {
    jest.mocked(noteRepo.findByIdAndUserId).mockResolvedValue(null);

    await expect(
      updateNoteSummary(
        "foreign-note",
        "user-1",
        "should not be written",
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(noteRepo.updateSummary).not.toHaveBeenCalled();
  });
});

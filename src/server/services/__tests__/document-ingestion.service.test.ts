jest.mock("@/server/services/upload.service");
jest.mock("@/server/services/note.service");
jest.mock("@/server/services/document-storage.service");
jest.mock("@/server/queues/pdf-ingestion.queue");
jest.mock("@/server/repositories/study-generation.repo");
jest.mock("@/server/repositories/note.repo");

import { enqueuePdfIngestion } from "@/server/queues/pdf-ingestion.queue";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import {
  deleteTemporaryUpload,
  saveTemporaryUpload,
} from "@/server/services/document-storage.service";
import { ingestDocument } from "@/server/services/document-ingestion.service";
import { createNote } from "@/server/services/note.service";
import {
  prepareUpload,
  processUpload,
  type UploadedFile,
} from "@/server/services/upload.service";

const pdf: UploadedFile = {
  buffer: Buffer.from("%PDF-test"),
  originalName: "paper.pdf",
  mimeType: "application/pdf",
  size: 9,
};

const note = {
  id: "note-1",
  userId: "user-1",
  title: "paper",
  fileName: "paper.pdf",
  fileType: "pdf" as const,
  fileSize: 9,
  content: "PDF extraction is running in the background.",
  summary: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("document-ingestion.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prepareUpload).mockReturnValue({
      fileName: "paper.pdf",
      fileType: "pdf",
      fileSize: 9,
    });
    jest.mocked(createNote).mockResolvedValue(note);
    jest.mocked(saveTemporaryUpload).mockResolvedValue("note-1-upload.pdf");
    jest.mocked(generationRepo.initialise).mockResolvedValue({} as never);
    jest.mocked(enqueuePdfIngestion).mockResolvedValue("pdf-ingest-note-1");
  });

  it("queues PDF extraction without parsing inside the HTTP request", async () => {
    const result = await ingestDocument("user-1", pdf);

    expect(processUpload).not.toHaveBeenCalled();
    expect(createNote).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ fileType: "pdf" }),
      expect.objectContaining({ deferGeneration: true }),
    );
    expect(enqueuePdfIngestion).toHaveBeenCalledWith({
      noteId: "note-1",
      userId: "user-1",
      storageKey: "note-1-upload.pdf",
    });
    expect(result.backgroundProcessing).toBe(true);
  });

  it("rolls back the note and temporary file when queueing fails", async () => {
    jest.mocked(enqueuePdfIngestion).mockRejectedValue(new Error("queue down"));

    await expect(ingestDocument("user-1", pdf)).rejects.toThrow("queue down");

    expect(deleteTemporaryUpload).toHaveBeenCalledWith("note-1-upload.pdf");
    expect(generationRepo.deleteByNoteId).toHaveBeenCalledWith("note-1");
    expect(noteRepo.deleteById).toHaveBeenCalledWith("note-1");
  });
});

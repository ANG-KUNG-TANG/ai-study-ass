jest.mock("@/server/intelligence/engine");
jest.mock("@/server/repositories/intelligence.repo");
jest.mock("@/server/repositories/note.repo");
jest.mock("@/server/services/ai.service");

import { runPipeline } from "@/server/intelligence/engine";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceRepo from "@/server/repositories/intelligence.repo";
import { runAndPersistPipeline } from "@/server/services/intelligence.service";

describe("intelligence symbolic fallback", () => {
  it("retries without AI when the AI-enabled run fails", async () => {
    jest.mocked(runPipeline)
      .mockRejectedValueOnce(
        new Error("AI quota exceeded"),
      )
      .mockResolvedValueOnce({
        noteId: "note-1",
        stage: "complete",
        core: {
          method: null,
          dataset: null,
          accuracy: null,
          problem: "Example problem",
          contributions: [],
          keyPoints: [],
          entities: [],
          extras: {},
        },
        ontology: [],
        graph: { nodes: [], edges: [] },
        prolog: { facts: [] },
        confidence: 0.55,
        processedAt: new Date(),
        gaps: [],
      } as never);

    jest.mocked(noteRepo.findById).mockResolvedValue({
      id: "note-1",
    } as never);

    jest.mocked(
      intelligenceRepo.upsert,
    ).mockResolvedValue(undefined as never);

    const result = await runAndPersistPipeline(
      "note-1",
      {
        rawText: "Document",
        fileName: "file.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
      },
    );

    expect(runPipeline).toHaveBeenCalledTimes(2);
    expect(
      jest.mocked(runPipeline).mock.calls[1][0],
    ).not.toHaveProperty("aiGenerate");
    expect(result).not.toBeNull();
  });
});

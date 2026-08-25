import type { UpdateQuery } from "mongoose";
import type { IStudyGeneration } from "@/server/models/StudyGeneration";

jest.mock("@/server/models/StudyGeneration", () => ({
  StudyGeneration: {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

import { StudyGeneration } from "@/server/models/StudyGeneration";
import {
  initialise,
  updateFeature,
  updateStage,
} from "@/server/repositories/study-generation.repo";

const timestamp = new Date("2026-08-25T00:00:00.000Z");

function stateDocument() {
  return {
    _id: "note-1",
    noteId: "note-1",
    userId: "user-1",
    stage: "pending",
    features: {
      summary: { status: "pending", updatedAt: timestamp },
      quiz: { status: "pending", updatedAt: timestamp },
      flashcards: { status: "pending", updatedAt: timestamp },
      chatKnowledge: { status: "pending", updatedAt: timestamp },
    },
    startedAt: timestamp,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("study-generation.repo timestamps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(StudyGeneration.findOneAndUpdate).mockReturnValue({
      lean: () => ({
        exec: async () => stateDocument(),
      }),
    } as never);
    jest.mocked(StudyGeneration.updateOne).mockReturnValue({
      exec: async () => ({ acknowledged: true }),
    } as never);
  });

  it("leaves top-level upsert timestamps to the Mongoose timestamps plugin", async () => {
    await initialise("note-1", "user-1");

    const update = jest.mocked(StudyGeneration.findOneAndUpdate).mock.calls[0]?.[1];

    expect(update?.$setOnInsert).not.toHaveProperty("createdAt");
    expect(update?.$setOnInsert).not.toHaveProperty("updatedAt");
  });

  it("does not duplicate the top-level updatedAt field in repository updates", async () => {
    await updateStage("note-1", "generating");
    await updateFeature("note-1", "summary", { status: "generating" });

    const stageUpdate = jest.mocked(StudyGeneration.updateOne)
      .mock.calls[0]?.[1] as UpdateQuery<IStudyGeneration> | undefined;
    const featureUpdate = jest.mocked(StudyGeneration.updateOne)
      .mock.calls[1]?.[1] as UpdateQuery<IStudyGeneration> | undefined;

    expect(stageUpdate?.$set).not.toHaveProperty("updatedAt");
    expect(featureUpdate?.$set).not.toHaveProperty("updatedAt");
    expect(featureUpdate?.$set).toEqual(expect.objectContaining({
      "features.summary.updatedAt": expect.any(Date),
    }));
  });
});

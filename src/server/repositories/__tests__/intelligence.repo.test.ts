import type { IntelligenceResultEntity } from "@/server/entities/intelligence.entity";
import type { GroundedKnowledge } from "@/server/intelligence/grounding";

jest.mock("@/server/models/Intelligence", () => ({
  PaperIntelligence: {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("@/server/repositories/grounded-knowledge.repo", () => ({
  upsert: jest.fn(),
  findByNoteId: jest.fn(),
  deleteByNoteId: jest.fn(),
}));

jest.mock("@/server/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { PaperIntelligence } from "@/server/models/Intelligence";
import * as groundedKnowledgeRepo from "@/server/repositories/grounded-knowledge.repo";
import {
  upsert,
  upsertFailed,
} from "@/server/repositories/intelligence.repo";

function groundingFixture(): GroundedKnowledge {
  return {
    sourceHash: "sha256:test-source",
    schemaVersion: "1",
    pipelineVersion: "grounding-v2",
    facts: [],
    sections: [],
    claims: [],
    concepts: [],
    relations: [],
    evidence: [],
    quality: {
      score: 1,
      warnings: [],
    },
  } as unknown as GroundedKnowledge;
}

function successEntity(
  grounding: GroundedKnowledge | null = groundingFixture(),
): IntelligenceResultEntity {
  return {
    toPersistence: () => ({
      noteId: "note-1",
      stage: "complete",
      core: {} as never,
      grounding,
      ontology: [],
      graph: {} as never,
      facts: [],
      confidence: 0.95,
      failedStage: null,
      failedReason: null,
      processedAt: new Date("2026-08-27T00:00:00.000Z"),
      gaps: null,
    }),
  } as unknown as IntelligenceResultEntity;
}

function failedEntity(): IntelligenceResultEntity {
  return {
    toPersistence: () => ({
      noteId: "note-1",
      stage: "graph",
      core: null,
      grounding: null,
      ontology: [],
      graph: null,
      facts: [],
      confidence: null,
      failedStage: "graph",
      failedReason: "graph construction failed",
      processedAt: new Date("2026-08-27T00:00:00.000Z"),
      gaps: null,
    }),
  } as unknown as IntelligenceResultEntity;
}

describe("intelligence.repo grounded knowledge persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(PaperIntelligence.findOneAndUpdate).mockResolvedValue(
      {} as never,
    );
    jest.mocked(groundedKnowledgeRepo.upsert).mockResolvedValue();
    jest.mocked(groundedKnowledgeRepo.deleteByNoteId).mockResolvedValue();
  });

  it("persists grounding whenever a successful intelligence result is persisted", async () => {
    const grounding = groundingFixture();

    await upsert(successEntity(grounding));

    expect(PaperIntelligence.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(groundedKnowledgeRepo.upsert).toHaveBeenCalledTimes(1);
    expect(groundedKnowledgeRepo.upsert).toHaveBeenCalledWith(
      "note-1",
      grounding,
    );
  });

  it("does not silently persist a successful result without grounding", async () => {
    await expect(upsert(successEntity(null))).rejects.toThrow(
      "Cannot persist successful intelligence result without grounded knowledge",
    );

    expect(PaperIntelligence.findOneAndUpdate).not.toHaveBeenCalled();
    expect(groundedKnowledgeRepo.upsert).not.toHaveBeenCalled();
  });

  it("removes stale grounding before marking a rerun as failed", async () => {
    await upsertFailed(failedEntity());

    expect(groundedKnowledgeRepo.deleteByNoteId).toHaveBeenCalledTimes(1);
    expect(groundedKnowledgeRepo.deleteByNoteId).toHaveBeenCalledWith("note-1");
    expect(PaperIntelligence.findOneAndUpdate).toHaveBeenCalledTimes(1);

    const deleteOrder =
      jest.mocked(groundedKnowledgeRepo.deleteByNoteId).mock
        .invocationCallOrder[0];
    const intelligenceWriteOrder =
      jest.mocked(PaperIntelligence.findOneAndUpdate).mock
        .invocationCallOrder[0];

    expect(deleteOrder).toBeLessThan(intelligenceWriteOrder);
  });

  it("does not mark a result failed if stale grounding could not be removed", async () => {
    jest.mocked(groundedKnowledgeRepo.deleteByNoteId).mockRejectedValue(
      new Error("grounded knowledge delete failed"),
    );

    await expect(upsertFailed(failedEntity())).rejects.toThrow(
      "grounded knowledge delete failed",
    );

    expect(PaperIntelligence.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

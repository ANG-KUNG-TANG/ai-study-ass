import type { GroundedKnowledge } from "@/server/intelligence/grounding";
import { GroundedKnowledgeModel } from "@/server/models/GroundedKnowledge";
import { logger } from "@/server/utils/logger";

export async function upsert(
  noteId: string,
  grounding: GroundedKnowledge,
): Promise<void> {
  await GroundedKnowledgeModel.findOneAndUpdate(
    { noteId },
    {
      noteId,
      sourceHash: grounding.sourceHash,
      schemaVersion: grounding.schemaVersion,
      pipelineVersion: grounding.pipelineVersion,
      data: grounding,
    },
    { upsert: true, returnDocument: "after" },
  );

  logger.info("Grounded knowledge persisted", {
    noteId,
    facts: grounding.facts.length,
    sections: grounding.sections.length,
    quality: grounding.quality.score,
  });
}

export async function findByNoteId(
  noteId: string,
): Promise<GroundedKnowledge | null> {
  const document = await GroundedKnowledgeModel.findOne(
    { noteId },
    { data: 1 },
  ).lean().exec();

  if (!document?.data) return null;

  return document.data as GroundedKnowledge;
}

export async function deleteByNoteId(noteId: string): Promise<void> {
  await GroundedKnowledgeModel.deleteOne({ noteId });
  logger.info("Grounded knowledge deleted", { noteId });
}

import { randomUUID } from "crypto";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { findKnowledgeObjectByNoteId } from "@/server/repositories/knowledge_object.repo";
import { FlashcardEntity } from "@/server/entities/flashcard.entity";
import { ForbiddenError, NotFoundError, BadRequestError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { FlashcardDifficulty } from "@/server/entities/flashcard.entity";

// ─── Generate flashcards ──────────────────────────────────────────────────────
// Builds front/back pairs from the knowledge object core fields.
// Each known fact becomes a card: front = question, back = answer.

export async function generateFlashcards(
  noteId: string,
  userId: string,
  count = 10
): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const ko = await findKnowledgeObjectByNoteId(noteId);
  if (!ko) throw new BadRequestError("Document has not been processed yet — please wait a moment and try again");

  const core = ko.core;
  const pairs: Array<{ front: string; back: string; difficulty: FlashcardDifficulty }> = [];

  // Core field cards
  if (core.method) {
    pairs.push({ front: "What is the main method proposed?", back: core.method, difficulty: "medium" });
  }
  if (core.dataset) {
    pairs.push({ front: "Which dataset is used for evaluation?", back: core.dataset, difficulty: "easy" });
  }
  if (core.metric) {
    pairs.push({ front: "What evaluation metric is used?", back: core.metric, difficulty: "easy" });
  }
  if (core.accuracy) {
    pairs.push({ front: "What performance result is reported?", back: core.accuracy, difficulty: "medium" });
  }
  if (core.topic) {
    pairs.push({ front: "What research domain does this paper belong to?", back: core.topic.replace(/_/g, " "), difficulty: "easy" });
  }
  if (core.problem) {
    pairs.push({ front: "What problem does this document address?", back: core.problem.slice(0, 300), difficulty: "hard" });
  }
  if (core.contribution) {
    pairs.push({ front: "What is the main contribution of this work?", back: core.contribution.slice(0, 300), difficulty: "hard" });
  }
  if (core.limitations) {
    pairs.push({ front: "What are the stated limitations?", back: core.limitations.slice(0, 300), difficulty: "hard" });
  }
  if (core.futureWork) {
    pairs.push({ front: "What future work is mentioned?", back: core.futureWork.slice(0, 300), difficulty: "medium" });
  }

  // Keyword definition cards — front: "What is X?", back: its context
  for (const keyword of core.keywords.slice(0, Math.max(0, count - pairs.length))) {
    pairs.push({
      front: `What is "${keyword}" in the context of this document?`,
      back: `"${keyword}" is one of the key concepts discussed in this document.`,
      difficulty: "medium",
    });
  }

  if (pairs.length === 0) {
    throw new BadRequestError("Not enough structured knowledge to generate flashcards");
  }

  const limited = pairs.slice(0, count);

  const entities = limited.map((p) =>
    FlashcardEntity.create({
      id: randomUUID(),
      noteId,
      userId,
      front: p.front,
      back: p.back,
      difficulty: p.difficulty,
    })
  );

  const saved = await flashcardRepo.createMany(entities);

  logger.info("Flashcards generated from knowledge object", {
    noteId,
    userId,
    count: saved.length,
  });

  return saved.map((f) => f.toPublic());
}

// ─── Get flashcards by note ───────────────────────────────────────────────────

export async function getFlashcardsByNote(
  noteId: string,
  userId: string
): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const flashcards = await flashcardRepo.findManyByNoteId(noteId);
  return flashcards.map((f) => f.toPublic());
}

// ─── Update review status ─────────────────────────────────────────────────────
// Called when a user marks a card as easy/medium/hard after reviewing it.

export async function updateReview(
  flashcardId: string,
  userId: string,
  difficulty: FlashcardDifficulty
): Promise<ReturnType<FlashcardEntity["toPublic"]>> {
  const flashcard = await flashcardRepo.findByIdOrThrow(flashcardId);
  if (!flashcard.belongsTo(userId)) throw new ForbiddenError();

  const updated = await flashcardRepo.updateReview(flashcardId, difficulty);
  if (!updated) throw new NotFoundError("Flashcard");

  return updated.toPublic();
}
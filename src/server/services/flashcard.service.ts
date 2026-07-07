import { randomUUID } from "crypto";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import { FlashcardEntity, type FlashcardDifficulty } from "@/server/entities/flashcard.entity";
import { ForbiddenError, BadRequestError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { KnowledgeCore } from "@/server/intelligence/types";
import { generate as aiGenerate } from "@/server/services/ai.service";

export async function generateFlashcards(
  noteId: string,
  userId: string,
  count = 10
): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const intelligence = await intelligenceService.getOrRunPipeline(noteId);
  const mode = intelligence.getConfidenceMode();

  let pairs: Array<{ front: string; back: string; difficulty: FlashcardDifficulty }> = [];

  if (mode !== "AI_REQUIRED" && intelligence.core) {
    pairs = buildCardsFromCore(intelligence.core, count);
    if (pairs.length > 0 && mode === "SYMBOLIC_WITH_OPTIONAL_AI_POLISH") {
      pairs = await polishFrontWordingOnly(pairs);
    }
  }

  if (pairs.length === 0) {
    pairs = await generateCardsViaAI(intelligence, note, count);
  }

  if (pairs.length === 0) {
    throw new BadRequestError("Not enough content to generate flashcards for this document");
  }

  const entities = pairs.slice(0, count).map((p) =>
    FlashcardEntity.create({ id: randomUUID(), noteId, userId, front: p.front, back: p.back, difficulty: p.difficulty })
  );

  await flashcardRepo.createMany(entities);
  logger.info("Flashcards generated", { noteId, userId, count: entities.length, mode });
  return entities.map((f) => f.toPublic());
}

export async function getFlashcardsByNote(noteId: string, userId: string): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();
  const flashcards = await flashcardRepo.findManyByNoteId(noteId);
  return flashcards.map((f) => f.toPublic());
}

export async function updateReview(flashcardId: string, userId: string, difficulty: FlashcardDifficulty): Promise<ReturnType<FlashcardEntity["toPublic"]>> {
  const flashcard = await flashcardRepo.findByIdOrThrow(flashcardId);
  if (!flashcard.belongsTo(userId)) throw new ForbiddenError();
  // perform update (repo may not return the updated entity)
  await flashcardRepo.updateReview(flashcardId, difficulty);
  // reload the entity to return the public view
  const reloaded = await flashcardRepo.findByIdOrThrow(flashcardId);
  return reloaded.toPublic();
}

function buildCardsFromCore(core: KnowledgeCore, count: number): Array<{ front: string; back: string; difficulty: FlashcardDifficulty }> {
  const pairs: Array<{ front: string; back: string; difficulty: FlashcardDifficulty }> = [];
  if (core.method) pairs.push({ front: "What is the main method proposed?", back: core.method, difficulty: "medium" });
  if (core.dataset) pairs.push({ front: "Which dataset is used for evaluation?", back: core.dataset, difficulty: "easy" });
  if (core.extras?.metric) pairs.push({ front: "What evaluation metric is used?", back: core.extras.metric, difficulty: "easy" });
  if (core.accuracy !== null) pairs.push({ front: "What performance result is reported?", back: `${core.accuracy}%`, difficulty: "medium" });
  if (core.extras?.topic) pairs.push({ front: "What research domain does this paper belong to?", back: core.extras.topic.replace(/_/g, " "), difficulty: "easy" });
  if (core.problem) pairs.push({ front: "What problem does this document address?", back: core.problem.slice(0, 300), difficulty: "hard" });
  for (const c of core.contributions.slice(0, 2)) pairs.push({ front: "What is a contribution of this work?", back: c.slice(0, 300), difficulty: "hard" });
  if (core.extras?.limitations) pairs.push({ front: "What are the stated limitations?", back: core.extras.limitations.slice(0, 300), difficulty: "hard" });
  if (core.extras?.futureWork) pairs.push({ front: "What future work is mentioned?", back: core.extras.futureWork.slice(0, 300), difficulty: "medium" });
  for (const kw of (core.extras?.keywords ?? []).slice(0, Math.max(0, count - pairs.length))) {
    pairs.push({ front: `What is "${kw}" in the context of this document?`, back: `"${kw}" is one of the key concepts discussed in this document.`, difficulty: "medium" });
  }
  return pairs.slice(0, count);
}

async function polishFrontWordingOnly(
  pairs: Array<{
    front: string;
    back: string;
    difficulty: FlashcardDifficulty;
  }>
) {
  return Promise.all(
    pairs.map(async (p) => {
      try {
        const result = await aiGenerate({
          prompt:
            `Rewrite this flashcard question to be clearer without changing its meaning.\n` +
            `Return ONLY the rewritten question.\n\n` +
            p.front,
          temperature: 0.2,
          maxTokens: 100,
        });

        const rewritten = result.text.trim();

        return rewritten
          ? { ...p, front: rewritten }
          : p;
      } catch {
        return p;
      }
    })
  );
}

async function generateCardsViaAI(
  intelligence: Awaited<ReturnType<typeof intelligenceService.getOrRunPipeline>>,
  note: Awaited<ReturnType<typeof noteRepo.findByIdOrThrow>>,
  count: number
): Promise<Array<{ front: string; back: string; difficulty: FlashcardDifficulty }>> {
  const prompt = [
    `Generate ${count} flashcards (front/back pairs) for a student studying this document.`,
    `Title: ${note.title}`,
    `Document excerpt:\n${note.content.slice(0, 3000)}`,
    `Return ONLY a JSON array: { "front": string, "back": string, "difficulty": "easy"|"medium"|"hard" }`,
  ].join("\n\n");

  const result = await aiGenerate(
    {
      prompt,
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true
    }
  );
  try {
    const parsed = JSON.parse(result.text.trim().replace(/^```json\s*|```$/g, ""));
    return Array.isArray(parsed) ? parsed.slice(0, count) : [];
  } catch {
    return [];
  }
}

export async function deleteForNote(noteId: string): Promise<void> {
  await flashcardRepo.deleteByNoteId(noteId);
  logger.info("Flashcard data deleted", { noteId });
}


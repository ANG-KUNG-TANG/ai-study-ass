import { randomUUID } from "crypto";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import { FlashcardEntity, type FlashcardDifficulty } from "@/server/entities/flashcard.entity";
import { ForbiddenError, BadRequestError, AIError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { KnowledgeCore } from "@/server/intelligence/types";
import { generate as aiGenerate } from "@/server/services/ai.service";
import { DEFAULT_FLASHCARDS } from "@/server/utils/constants";

export async function generateFlashcards(
  noteId: string,
  userId: string,
  count = DEFAULT_FLASHCARDS
): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const intelligence = await intelligenceService.getOrRunPipeline(noteId);
  const mode = intelligence.getConfidenceMode();

  let pairs: Array<{ front: string; back: string; difficulty: FlashcardDifficulty }> = [];
  let aiUnavailable = false;

  if (mode !== "AI_REQUIRED" && intelligence.core) {
    pairs = buildCardsFromCore(intelligence.core, count);
    if (pairs.length > 0 && mode === "SYMBOLIC_WITH_OPTIONAL_AI_POLISH") {
      // polishFrontWordingOnly already swallows per-card failures (see its own
      // try/catch) and returns the original front on error, so no wrapping
      // needed here — a polish failure just means unpolished-but-correct cards.
      pairs = await polishFrontWordingOnly(pairs);
    }
  }

  // Only reached when: mode === AI_REQUIRED, or the symbolic pass produced
  // zero cards despite a non-AI_REQUIRED mode (sparse extraction). Either way
  // we need AI content — but a missing/invalid API key must degrade to
  // "return what we have" rather than 502 the whole request.
  if (pairs.length === 0) {
    try {
      pairs = await generateCardsViaAI(intelligence, note, count);
    } catch (err) {
      if (!(err instanceof AIError)) throw err; // unexpected error type — don't swallow

      aiUnavailable = true;
      logger.warn("AI generation failed for flashcards — falling back to symbolic extraction only", {
        noteId,
        mode,
        error: err.message,
      });

      // Last-ditch symbolic attempt even in AI_REQUIRED mode: better a few
      // low-confidence cards than a hard failure, as long as we're honest
      // that mode was gated toward AI. If core is null/empty this still
      // yields [] and we fall through to the BadRequestError below.
      if (intelligence.core) {
        pairs = buildCardsFromCore(intelligence.core, count);
      }
    }
  }

  if (pairs.length === 0) {
    throw new BadRequestError(
      aiUnavailable
        ? "AI generation is unavailable and this document doesn't have enough extracted content to generate flashcards without it. Configure an AI provider or try a more detailed document."
        : "Not enough content to generate flashcards for this document"
    );
  }

  const entities = pairs.slice(0, count).map((p) =>
    FlashcardEntity.create({ id: randomUUID(), noteId, userId, front: p.front, back: p.back, difficulty: p.difficulty })
  );

  await flashcardRepo.createMany(entities);
  logger.info("Flashcards generated", { noteId, userId, count: entities.length, mode, aiUnavailable });
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
  await flashcardRepo.updateReview(flashcardId, difficulty);
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
  pairs: Array<{ front: string; back: string; difficulty: FlashcardDifficulty }>
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
        return rewritten ? { ...p, front: rewritten } : p;
      } catch {
        // Already tolerant of AI failure — including a missing API key, since
        // generate() throws AIError in that case too. Falls back to the
        // unpolished (but perfectly valid) symbolic front text.
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

  // NOTE: this now lets AIError propagate to the caller (generateFlashcards),
  // which decides whether to fall back to symbolic cards or surface a proper
  // error. Previously any thrown error here would bubble uncaught all the way
  // to the route handler as an unhandled 502 — this function itself is
  // unchanged except for that removed inner try/catch-to-[] on the AI call
  // (the JSON-parse try/catch below is unrelated and stays, since malformed
  // JSON from a live provider is a different failure mode than no provider).
  const result = await aiGenerate({
    prompt,
    temperature: 0.3,
    maxTokens: 2000,
    jsonMode: true,
  });
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
import { randomUUID } from "crypto";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import {
  FlashcardEntity,
  type FlashcardDifficulty,
} from "@/server/entities/flashcard.entity";
import { ForbiddenError, BadRequestError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { KnowledgeCore } from "@/server/intelligence/types";
import { generate } from "@/server/services/ai.service";
import { DEFAULT_FLASHCARDS } from "@/server/utils/constants";
import { buildFlashcardsFromSource } from "@/server/services/symbolic-content.service";
import { sampleDocumentContent } from "@/server/services/document-sampling.service";
import { parseStructuredArray } from "@/server/utils/structured-output";
import type {
  GenerationMetadata,
  GenerationSource,
} from "@/server/types/generation";

interface FlashcardPair {
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
}

export interface FlashcardGenerationResult {
  flashcards: ReturnType<FlashcardEntity["toPublic"]>[];
  metadata: GenerationMetadata;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildCardsFromCore(
  core: KnowledgeCore,
  count: number,
): FlashcardPair[] {
  const cards: FlashcardPair[] = [];

  if (core.method) {
    cards.push({
      front: "What is the main method proposed or evaluated?",
      back: core.method,
      difficulty: "medium",
    });
  }

  if (core.dataset) {
    cards.push({
      front: "Which dataset is used?",
      back: core.dataset,
      difficulty: "easy",
    });
  }

  if (core.extras?.metric) {
    cards.push({
      front: "Which evaluation metric is used?",
      back: core.extras.metric,
      difficulty: "easy",
    });
  }

  if (core.accuracy !== null) {
    cards.push({
      front: "What performance result is reported?",
      back: `${core.accuracy}%`,
      difficulty: "medium",
    });
  }

  if (core.problem) {
    cards.push({
      front: "What problem does the document address?",
      back: core.problem.slice(0, 350),
      difficulty: "hard",
    });
  }

  core.contributions.forEach((contribution, index) => {
    if (cards.length >= count) return;
    cards.push({
      front: `What is contribution ${index + 1} identified in the document?`,
      back: contribution.slice(0, 350),
      difficulty: "hard",
    });
  });

  for (const point of core.keyPoints) {
    if (cards.length >= count) break;
    cards.push({
      front: `What is important about "${point.label}"?`,
      back: point.value.slice(0, 350),
      difficulty: "medium",
    });
  }

  return cards.slice(0, count);
}

function deduplicateCards(cards: FlashcardPair[]): FlashcardPair[] {
  const seenFronts = new Set<string>();
  const seenAnswers = new Set<string>();

  return cards.filter((card) => {
    const front = normalize(card.front);
    const back = normalize(card.back);

    if (!front || !back || seenFronts.has(front) || seenAnswers.has(back)) {
      return false;
    }

    seenFronts.add(front);
    seenAnswers.add(back);
    return true;
  });
}

function parseFlashcard(value: unknown): FlashcardPair | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Record<string, unknown>;

  if (typeof card.front !== "string" || typeof card.back !== "string") {
    return null;
  }

  const front = card.front.trim();
  const back = card.back.trim();
  const difficulty = card.difficulty;

  if (front.length < 5 || back.length < 3) return null;
  if (
    difficulty !== "easy" &&
    difficulty !== "medium" &&
    difficulty !== "hard"
  ) {
    return null;
  }

  return {
    front: front.slice(0, 300),
    back: back.slice(0, 500),
    difficulty,
  };
}

async function generateCardsViaAI(
  title: string,
  content: string,
  count: number,
  userId: string,
  noteId: string,
): Promise<{
  cards: FlashcardPair[];
  tokensUsed: number;
  recovered: boolean;
}> {
  const sample = sampleDocumentContent(content, 20_000);

  const result = await generate({
    systemPrompt:
      "Create factual study flashcards using only the uploaded document. " +
      "Return only valid JSON. Prefer fewer valid cards over invented content.",
    prompt: `
Generate up to ${count} additional flashcards.

Rules:
- Test one useful concept or fact per card.
- Every question must be specific and unique.
- Every answer must be directly supported by the document.
- Avoid vague prompts such as "What important fact is explained?".
- Do not duplicate information already implied by another card.

Return exactly this object shape:
{
  "flashcards": [
    {
      "front": "question",
      "back": "answer",
      "difficulty": "easy"
    }
  ]
}

Allowed difficulty values: "easy", "medium", "hard".

Title: ${title}

Document sample${sample.truncated ? " (sampled across the full document)" : ""}:
${sample.text}
`.trim(),
    temperature: 0.2,
    maxTokens: 3_000,
    jsonMode: true,
    usageLabel: "flashcards",
    userId,
    noteId,
  });

  const parsed = parseStructuredArray(
    result.text,
    "flashcards",
    parseFlashcard,
  );

  if (parsed.items.length === 0) {
    throw new Error("AI returned no valid flashcards.");
  }

  return {
    cards: parsed.items,
    tokensUsed: result.tokensUsed,
    recovered: parsed.recovered,
  };
}

export async function generateFlashcardsWithMetadata(
  noteId: string,
  userId: string,
  count = DEFAULT_FLASHCARDS,
  options: { force?: boolean } = {},
): Promise<FlashcardGenerationResult> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  if (!note.belongsTo(userId)) {
    throw new ForbiddenError();
  }

  const existing = await flashcardRepo.findManyByNoteId(noteId);

  if (existing.length > 0 && !options.force) {
    return {
      flashcards: existing.map((card) => card.toPublic()),
      metadata: {
        source: "symbolic",
        confidence: 1,
        aiFallbackUsed: false,
        status: "ready",
        itemCount: existing.length,
        tokensUsed: 0,
      },
    };
  }

  const intelligence = await intelligenceService
    .getOrRunPipeline(noteId)
    .catch(() => null);

  const coreCards = intelligence?.core
    ? buildCardsFromCore(intelligence.core, count)
    : [];

  const sourceCards = buildFlashcardsFromSource(note.content, count);

  let pairs = deduplicateCards([...coreCards, ...sourceCards]).slice(0, count);

  const symbolicCount = pairs.length;
  let source: GenerationSource = "symbolic";
  let aiFallbackUsed = false;
  let tokensUsed = 0;

  const missingCount = Math.max(0, count - pairs.length);

  if (missingCount > 0) {
    try {
      const ai = await generateCardsViaAI(
        note.title,
        note.content,
        missingCount,
        userId,
        noteId,
      );

      pairs = deduplicateCards([...pairs, ...ai.cards]).slice(0, count);
      source = symbolicCount > 0 ? "hybrid" : "ai_fallback";
      aiFallbackUsed = ai.cards.length > 0;
      tokensUsed = ai.tokensUsed;

      if (ai.recovered) {
        logger.warn("Recovered valid flashcards from incomplete AI JSON", {
          noteId,
          recoveredCount: ai.cards.length,
        });
      }
    } catch (error) {
      logger.warn("AI flashcard fallback unavailable; keeping symbolic cards", {
        noteId,
        requested: count,
        symbolicCount,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (pairs.length === 0) {
    throw new BadRequestError(
      "Not enough document content was available to generate flashcards.",
    );
  }

  if (options.force && existing.length > 0) {
    await flashcardRepo.deleteByNoteId(noteId);
  }

  const entities = pairs.map((pair) =>
    FlashcardEntity.create({
      id: randomUUID(),
      noteId,
      userId,
      front: pair.front,
      back: pair.back,
      difficulty: pair.difficulty,
    }),
  );

  await flashcardRepo.createMany(entities);

  const confidence = Math.min(
    1,
    0.35 +
      (entities.length / count) * 0.45 +
      (intelligence?.confidence ?? 0) * 0.2,
  );

  const status =
    entities.length >= Math.max(4, Math.ceil(count * 0.7))
      ? "ready"
      : "partial";

  logger.info("Flashcards generated", {
    noteId,
    userId,
    count: entities.length,
    requested: count,
    source,
    aiFallbackUsed,
  });

  return {
    flashcards: entities.map((entity) => entity.toPublic()),
    metadata: {
      source,
      confidence,
      aiFallbackUsed,
      status,
      itemCount: entities.length,
      tokensUsed,
    },
  };
}

export async function generateFlashcards(
  noteId: string,
  userId: string,
  count = DEFAULT_FLASHCARDS,
): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  return (await generateFlashcardsWithMetadata(noteId, userId, count))
    .flashcards;
}

export async function getFlashcardsByNote(
  noteId: string,
  userId: string,
): Promise<ReturnType<FlashcardEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const flashcards = await flashcardRepo.findManyByNoteId(noteId);
  return flashcards.map((card) => card.toPublic());
}

export async function updateReview(
  flashcardId: string,
  userId: string,
  difficulty: FlashcardDifficulty,
): Promise<ReturnType<FlashcardEntity["toPublic"]>> {
  const flashcard = await flashcardRepo.findByIdOrThrow(flashcardId);
  if (!flashcard.belongsTo(userId)) throw new ForbiddenError();

  await flashcardRepo.updateReview(flashcardId, difficulty);
  return (await flashcardRepo.findByIdOrThrow(flashcardId)).toPublic();
}

export async function deleteForNote(noteId: string): Promise<void> {
  await flashcardRepo.deleteByNoteId(noteId);
  logger.info("Flashcard data deleted", { noteId });
}

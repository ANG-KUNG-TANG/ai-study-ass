import { Flashcard } from "../models/Flashcard";
import { FlashcardEntity, type FlashcardProps, type FlashcardId } from "../entities/flashcard.entity";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";

// ─── Mapper ───────────────────────────────────────────────────────────────────
function toEntity(doc: any): FlashcardEntity {
  return FlashcardEntity.fromPersistence({
    id: String(doc._id),
    noteId: String(doc.noteId),
    userId: String(doc.userId),
    front: doc.front,
    back: doc.back,
    difficulty: doc.difficulty,
    reviewCount: doc.reviewCount,
    lastReviewedAt: doc.lastReviewedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function findById(id: FlashcardId): Promise<FlashcardEntity | null> {
  const doc = await Flashcard.findById(id).lean().exec();
  if (!doc) return null;
  return toEntity(doc);
}

export async function findByIdOrThrow(id: FlashcardId): Promise<FlashcardEntity> {
  const doc = await Flashcard.findById(id).lean().exec();
  if (!doc) throw new NotFoundError("Flashcard");
  return toEntity(doc);
}

// Single canonical "list by note" function — findByNoteId and findManyByNoteId
// were exact duplicates; kept the name the service actually calls.
export async function findManyByNoteId(noteId: string): Promise<FlashcardEntity[]> {
  const docs = await Flashcard.find({ noteId }).lean().exec();
  return docs.map(toEntity);
}

export async function findByNoteAndUserId(noteId: string, userId: string): Promise<FlashcardEntity[]> {
  const docs = await Flashcard.find({ noteId, userId }).lean().exec();
  return docs.map(toEntity);
}

export async function existsByNoteId(noteId: string): Promise<boolean> {
  return Boolean(await Flashcard.exists({ noteId }));
}

// ─── Create ───────────────────────────────────────────────────────────────────
// This was previously split across a working create() and a stub createMany()
// that threw "Function not implemented." — the service calls createMany(),
// so that's the name that survives, with the real insertMany logic moved in.

export async function createMany(entities: FlashcardEntity[]): Promise<FlashcardEntity[]> {
  const docs = await Flashcard.insertMany(
    entities.map((e) => {
      const d = e.toPersistence();
      return {
        _id: d.id,
        noteId: d.noteId,
        userId: d.userId,
        front: d.front,
        back: d.back,
        difficulty: d.difficulty,
        reviewCount: d.reviewCount,
        lastReviewedAt: d.lastReviewedAt,
      };
    })
  );
  logger.info("Flashcards created", { count: docs.length });
  return docs.map((d) => toEntity(d.toObject()));
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateReview(
  id: FlashcardId,
  difficulty: FlashcardEntity["difficulty"]
): Promise<void> {
  await Flashcard.findByIdAndUpdate(id, {
    difficulty,
    $inc: { reviewCount: 1 },
    lastReviewedAt: new Date(),
    updatedAt: new Date(),
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteById(id: FlashcardId): Promise<void> {
  await Flashcard.findByIdAndDelete(id);
}

export async function deleteByNoteId(noteId: string): Promise<void> {
  await Flashcard.deleteMany({ noteId });
}

export async function deleteByUserId(userId: string): Promise<void> {
  await Flashcard.deleteMany({ userId });
}
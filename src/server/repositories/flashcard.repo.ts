import {
  Flashcard,
  type FlashcardDocument,
  type FlashcardPersistence,
} from "@/server/models/Flashcard";
import {
  FlashcardEntity,
  type FlashcardId,
} from "@/server/entities/flashcard.entity";
import { logger } from "@/server/utils/logger";
import { NotFoundError } from "@/server/utils/errors";

type FlashcardRecord =
  Pick<
    FlashcardPersistence,
    | "_id"
    | "noteId"
    | "userId"
    | "front"
    | "back"
    | "difficulty"
    | "reviewCount"
    | "lastReviewedAt"
    | "createdAt"
    | "updatedAt"
  >;

function toEntity(
  doc: FlashcardRecord,
): FlashcardEntity {
  return FlashcardEntity.fromPersistence({
    id: String(doc._id),
    noteId: String(doc.noteId),
    userId: String(doc.userId),
    front: doc.front,
    back: doc.back,
    difficulty: doc.difficulty,
    reviewCount:
      doc.reviewCount ?? 0,
    lastReviewedAt:
      doc.lastReviewedAt ?? null,
    createdAt:
      doc.createdAt ?? new Date(),
    updatedAt:
      doc.updatedAt ?? new Date(),
  });
}

export async function findById(
  id: FlashcardId,
): Promise<FlashcardEntity | null> {
  const doc =
    await Flashcard.findById(id)
      .lean<FlashcardRecord>()
      .exec();

  return doc ? toEntity(doc) : null;
}

export async function findByIdOrThrow(
  id: FlashcardId,
): Promise<FlashcardEntity> {
  const flashcard =
    await findById(id);

  if (!flashcard) {
    throw new NotFoundError(
      "Flashcard",
    );
  }

  return flashcard;
}

export async function findManyByNoteId(
  noteId: string,
): Promise<FlashcardEntity[]> {
  const docs =
    await Flashcard.find({
      noteId,
    })
      .sort({ createdAt: 1 })
      .lean<FlashcardRecord[]>()
      .exec();

  return docs.map(toEntity);
}

export async function findByNoteAndUserId(
  noteId: string,
  userId: string,
): Promise<FlashcardEntity[]> {
  const docs =
    await Flashcard.find({
      noteId,
      userId,
    })
      .sort({ createdAt: 1 })
      .lean<FlashcardRecord[]>()
      .exec();

  return docs.map(toEntity);
}

export async function existsByNoteId(
  noteId: string,
): Promise<boolean> {
  return Boolean(
    await Flashcard.exists({
      noteId,
    }),
  );
}

export async function createMany(
  entities: FlashcardEntity[],
): Promise<FlashcardEntity[]> {
  if (entities.length === 0) {
    return [];
  }

  const now = new Date();

  const payload =
    entities.map((entity) => {
      const value =
        entity.toPersistence();

      return {
        _id: value.id,
        noteId: value.noteId,
        userId: value.userId,
        front: value.front,
        back: value.back,
        difficulty:
          value.difficulty,
        reviewCount:
          value.reviewCount,
        lastReviewedAt:
          value.lastReviewedAt,
        createdAt:
          value.createdAt ?? now,
        updatedAt:
          value.updatedAt ?? now,
      };
    });

  const docs =
    await Flashcard.insertMany(
      payload,
      {
        ordered: true,
      },
    );

  logger.info(
    "Flashcards created",
    {
      count: docs.length,
      noteId:
        payload[0]?.noteId,
    },
  );

  return docs.map(
    (document: FlashcardDocument) =>
      toEntity(
        document.toObject() as
          FlashcardRecord,
      ),
  );
}

export async function updateReview(
  id: FlashcardId,
  difficulty:
    FlashcardEntity["difficulty"],
): Promise<void> {
  const result =
    await Flashcard.updateOne(
      { _id: id },
      {
        $set: {
          difficulty,
          lastReviewedAt:
            new Date(),
        },
        $inc: {
          reviewCount: 1,
        },
      },
    ).exec();

  if (result.matchedCount === 0) {
    throw new NotFoundError(
      "Flashcard",
    );
  }
}

export async function count(): Promise<number> {
  return Flashcard.countDocuments();
}

export async function deleteById(
  id: FlashcardId,
): Promise<void> {
  await Flashcard.deleteOne({
    _id: id,
  }).exec();
}

export async function deleteByNoteId(
  noteId: string,
): Promise<void> {
  await Flashcard.deleteMany({
    noteId,
  }).exec();
}

export async function deleteByUserId(
  userId: string,
): Promise<void> {
  await Flashcard.deleteMany({
    userId,
  }).exec();
}

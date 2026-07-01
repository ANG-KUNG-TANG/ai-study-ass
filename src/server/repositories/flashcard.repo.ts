import { Flashcard } from "../models/Flashcard";
import { FlashcardEntity, type FlashcardProps, type FlashcardId } from "../entities/flashcard.entity";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";

//Mapper
function toEnitiy(doc: any): FlashcardEntity{
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
    })
};

//Read
export async function findById(id:FlashcardId): Promise<FlashcardEntity | null> {
    const doc = await Flashcard.findById(id).lean().exec();
    if (!doc) return null;
    return toEnitiy(doc);
    
}

export async function findByNoteId(noteId:string): Promise<FlashcardEntity[]> {
    const docs = await Flashcard.find({noteId}).lean().exec();
    return docs.map(toEnitiy);
    
}

export async function findNoteByUserId(noteId:string, userId: string): Promise<FlashcardEntity[]>{
    const docs = await Flashcard.find({ noteId, userId}).lean().exec();
    return docs.map(toEnitiy);
    
}

export async function existByNoteId(noteId:string): Promise<boolean> {
    return Boolean(await Flashcard.exists({noteId}));
}

//create
export async function create(entities: FlashcardEntity[]): Promise<FlashcardEntity[]> {
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
            }
        })
    );
    logger.info("FlashCared created", { count: docs.length});
    return docs.map((d) => toEnitiy(d.toObject()));    
}

//update
export async function updateReview(id:FlashcardId, difficulty: FlashcardEntity['difficulty']): Promise<void> {
    await Flashcard.findByIdAndUpdate(id, {
        difficulty,
        $inc:  { reviewCount: 1},
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
    });
    
}

//delete
export async function  deleteById(id:FlashcardId): Promise<void> {
    await Flashcard.findByIdAndDelete(id);
    
}

export async function deleteByNoteId(noteId:string): Promise<void> {
    await Flashcard.deleteMany({noteId})
    
}

export async function deleteByUserId(userId:string): Promise<void> {
    await Flashcard.deleteMany({ userId})
    
};

//findByIdOrthrown
export async function findByIdOrT(id:FlashcardId): Promise<FlashcardEntity> {
    const doc = await Flashcard.findById(id).lean().exec();
    if (!doc) throw new NotFoundError("Flashcard");
    return toEnitiy(doc);
    
}
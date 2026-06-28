import { Quiz } from "@/server/models/Quiz";
import { QuizEntity, type QuizProps, type QuizId } from "../entities/quiz.entity";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";


//mapper
function toEntity(doc: any): QuizEntity{
    return QuizEntity.fromPersistence({
        id: String(doc._id),
        noteId: String(doc.noteId),
        userId: String(doc.userId),
        questions: doc.questions,
        difficulty: doc.difficulty,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    })
};

//Read
export async function findById(id: QuizId): Promise<QuizEntity | null> {
    const doc = await Quiz.findById(id);
    if (!doc)  return null;
    return toEntity(doc);
}

export async function findByNoteId(noteId:string): Promise<QuizEntity[]> {
    const docs = await Quiz.find({noteId}).lean().exec();
    return docs.map(toEntity);   
}

export async function findByNoteIdAndUserId(
    noteId:string,
    userId: string
): Promise<QuizEntity | null> {
    const doc = await Quiz.findOne({noteId, userId}).lean().exec();
    if (!doc) return null;
    return toEntity(doc);
}

export async function existsByNoteId(
    noteId:string): Promise<boolean> {
        return Boolean(await Quiz.exists({noteId}));
}

//create
export async function create(entity:QuizEntity): Promise<QuizEntity> {
    const data = entity.toPersistence();
    const doc = await Quiz.create({
        _id: data.id,
        noteId: data.noteId,
        userId: data.userId,
        questions: data.questions,
        difficulty: data.difficulty,
    });
    logger.info("Quiz created", { quizId: String(doc._id), noteId: data.noteId});
    return toEntity(doc)
    
}

//Delete
export async function deleteById(id:QuizId): Promise<void> {
    await Quiz.findByIdAndDelete(id);
}

export async function  deleteNoteById(noteId:string): Promise<void> {
    await Quiz.deleteMany({ noteId})   
}


//findBYIdorThrow
export async function findByIdOrThrow(id:QuizId): Promise<QuizEntity> {
    const doc = await Quiz.findById(id).lean().exec();
    if (!doc) throw new NotFoundError("Quiz");
    return toEntity(doc);
    
}

export async function findByNoteIdOrRhrow(noteId:string): Promise<QuizEntity> {
    const doc = await Quiz.findOne({ noteId}).lean().exec();
    if (!doc) throw new NotFoundError("Quiz");
    return toEntity(doc);
    
}
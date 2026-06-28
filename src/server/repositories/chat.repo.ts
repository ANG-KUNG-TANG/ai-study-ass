import { Chat } from "../models/Chat";
import { ChatEntity, type ChatProps, type ChatId } from "../entities/chat.entity";
import { CHAT_HISTORY_LIMIT } from "../utils/constants";
import { logger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";


//mapper 
function toEntity(doc: any): ChatEntity{
    return ChatEntity.fromPersistence({
        id: String(doc._id),
        noteId: String(doc.id),
        userId: String(doc.userId),
        question: doc.question,
        answer: doc.answer,
        tokensUsed: doc.tokenUsed,
        provider: doc.rpovider,
        createdAt: doc.createdAt,
    });
}

//read
export async function findByNoteIdAndUserId(noteId:string, userId: string, limit = CHAT_HISTORY_LIMIT): Promise<ChatEntity[]> {
    const docs = await Chat.find({ noteId, userId})
        .sort({ createdAt: -1})
        .limit(limit)
        .lean()
        .exec();
    
    //return in chronological order for context building
    return docs.map(toEntity).reverse();
}

export async function countByNoteIdAndUserId(noteId:string, userId: string): Promise<number> {
    return Chat.countDocuments({noteId, userId});
    
}

//Create
export async function create(entity:ChatEntity): Promise<ChatEntity> {
    const data = entity.toPersistence();
    const doc = await Chat.create({
        _id: data.id,
        noteId: data.id,
        userId: data.userId,
        question: data.question,
        answer: data.answer,
        tokensUsed: data.tokensUsed,
        provider: data.provider
    });
    logger.info("Chat message saved", { noteId: data.noteId, userId: data.userId});
    return toEntity(doc.toObject());
    
};

//delete
export async function deleteByNoteIdAndUserId(noteId:string, userId: string): Promise<void> {
    await Chat.deleteMany({ noteId, userId});
    logger.info("Chat history cleared", { noteId, userId});    
}

export async function deleteBuNoteId(noteId:string): Promise<void> {
    await Chat.deleteMany({ noteId})
}

export async function deleteBuUserId(userId:string): Promise<void> {
    await Chat.deleteMany({userId})
}

//findByIdOrThrown
export async function findByIdOrThrow(id:ChatId): Promise<ChatEntity> {
    const doc = await Chat.findById(id).lean().exec();
    if (!doc) throw new NotFoundError("Chat message");
    return toEntity(doc);
    
}
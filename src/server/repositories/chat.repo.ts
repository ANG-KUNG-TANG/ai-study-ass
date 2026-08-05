import {
  Chat,
  type ChatPersistence,
} from "@/server/models/Chat";
import {
  ChatEntity,
  type ChatId,
} from "@/server/entities/chat.entity";
import {
  CHAT_HISTORY_LIMIT,
} from "@/server/utils/constants";
import {
  logger,
} from "@/server/utils/logger";
import {
  NotFoundError,
} from "@/server/utils/errors";

type ChatRecord =
  Pick<
    ChatPersistence,
    | "_id"
    | "noteId"
    | "userId"
    | "question"
    | "answer"
    | "tokensUsed"
    | "provider"
    | "createdAt"
  >;

function toEntity(
  doc: ChatRecord,
): ChatEntity {
  return ChatEntity.fromPersistence({
    id: String(doc._id),
    noteId: String(doc.noteId),
    userId: String(doc.userId),
    question: doc.question,
    answer: doc.answer,
    tokensUsed:
      doc.tokensUsed ?? 0,
    provider:
      doc.provider ?? "symbolic",
    createdAt:
      doc.createdAt ?? new Date(),
  });
}

export async function findByNoteIdAndUserId(
  noteId: string,
  userId: string,
  limit = CHAT_HISTORY_LIMIT,
): Promise<ChatEntity[]> {
  const safeLimit =
    Number.isFinite(limit)
      ? Math.max(1, Math.floor(limit))
      : CHAT_HISTORY_LIMIT;

  const docs =
    await Chat.find({
      noteId,
      userId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(safeLimit)
      .lean<ChatRecord[]>()
      .exec();

  return docs
    .map(toEntity)
    .reverse();
}

export async function countByNoteIdAndUserId(
  noteId: string,
  userId: string,
): Promise<number> {
  return Chat.countDocuments({
    noteId,
    userId,
  });
}

export async function create(
  entity: ChatEntity,
): Promise<ChatEntity> {
  const data =
    entity.toPersistence();

  const document =
    await Chat.create({
      _id: data.id,
      noteId: data.noteId,
      userId: data.userId,
      question: data.question,
      answer: data.answer,
      tokensUsed:
        data.tokensUsed,
      provider:
        data.provider,
      createdAt:
        data.createdAt,
    });

  logger.info(
    "Chat message saved",
    {
      chatId: data.id,
      noteId: data.noteId,
      userId: data.userId,
      provider:
        data.provider,
    },
  );

  return toEntity(
    document.toObject() as ChatRecord,
  );
}

export async function deleteByNoteIdAndUserId(
  noteId: string,
  userId: string,
): Promise<void> {
  await Chat.deleteMany({
    noteId,
    userId,
  }).exec();

  logger.info(
    "Chat history cleared",
    {
      noteId,
      userId,
    },
  );
}

export async function deleteByNoteId(
  noteId: string,
): Promise<void> {
  await Chat.deleteMany({
    noteId,
  }).exec();
}

export async function deleteByUserId(
  userId: string,
): Promise<void> {
  await Chat.deleteMany({
    userId,
  }).exec();
}

export async function findByIdOrThrow(
  id: ChatId,
): Promise<ChatEntity> {
  const doc =
    await Chat.findById(id)
      .lean<ChatRecord>()
      .exec();

  if (!doc) {
    throw new NotFoundError(
      "Chat message",
    );
  }

  return toEntity(doc);
}

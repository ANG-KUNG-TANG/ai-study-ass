import { randomUUID } from "crypto";
import * as chatRepo from "@/server/repositories/chat.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import { ChatEntity, CHAT_RULES } from "@/server/entities/chat.entity";
import { ForbiddenError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { buildChatPrompt } from "@/server/services/chat/chat.prompt";
import { generate as aiGenerate } from "@/server/services/ai.service";

export async function sendMessage(
  noteId: string,
  userId: string,
  question: string
): Promise<ReturnType<ChatEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const intelligence = await intelligenceService.getOrRunPipeline(noteId);
  const mode = intelligence.getConfidenceMode();

  const history = await chatRepo.findHistoryByNoteId(noteId, userId, CHAT_RULES.question.maxLength);

  const { systemPrompt, prompt } = buildChatPrompt(note.title, intelligence, mode, history, question);

  const aiResult = await aiGenerate({ prompt, systemPrompt });

  const entity = ChatEntity.create({
    id: randomUUID(), userId, noteId, question, answer: aiResult.text,
    provider: aiResult.provider,
    tokensUsed: aiResult.tokensUsed,
  });

  const saved = await chatRepo.create(entity);
  logger.info("Chat message saved", { noteId, userId, mode });
  return saved.toPublic();
}

export async function getChatHistory(noteId: string, userId: string): Promise<ReturnType<ChatEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();
  const history = await chatRepo.findHistoryByNoteId(noteId, userId);
  return history.map((m) => m.toPublic());
}

export async function clearHistory(noteId: string, userId: string): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();
  await chatRepo.deleteByNoteId(noteId);
  logger.info("Chat history cleared", { noteId, userId });
}

export async function deleteForNote(noteId: string): Promise<void> {
  await chatRepo.deleteByNoteId(noteId);
  logger.info("Chat history deleted", { noteId });
}